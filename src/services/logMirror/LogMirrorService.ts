import * as fs from "fs";
import * as path from "path";
import { inject, injectable } from "inversify";
import { WorkspaceFolder, window } from "vscode";
import { ILogMessage } from "../../models/ILogMessage";
import { NoConfig } from "../../models/Config";
import TYPES from "../../Types";
import { IConfigRepositoryService } from "../configRepository/IConfigRepositoryService";
import { formatError } from "../formatError";
import {
    endWriteStream,
    formatMirrorLine,
    normalizeMaxSizeMb,
    resolveMirrorPath,
    shouldRotate,
} from "./LogMirror";
import { ILogMirrorService } from "./ILogMirrorService";

@injectable()
export class LogMirrorService implements ILogMirrorService {
    private mirrorStream: fs.WriteStream | undefined = undefined;
    private mirrorPath: string | undefined = undefined;
    private bytesWritten = 0;
    private maxSizeMb = 10;
    private backpressure = false;
    private droppedWhileBackpressure = 0;
    private droppedWhileRotating = 0;
    private rotating = false;
    private warnedThisSession = false;
    private generation = 0;

    constructor(
        @inject(TYPES.services.configRepository) private configRepositoryService: IConfigRepositoryService,
    ) {}

    async open(workspaceFolder: WorkspaceFolder): Promise<void> {
        const gen = ++this.generation;
        await this.closeStream();
        this.resetMirrorFields();
        if (!this.isCurrent(gen)) {
            return;
        }

        try {
            const cfg = await this.configRepositoryService.read(workspaceFolder);
            if (!this.isCurrent(gen)) {
                return;
            }
            if (cfg instanceof NoConfig || cfg.mirrorIoBrokerJavaScriptLog !== true) {
                return;
            }

            const configuredPath = cfg.ioBrokerLogMirrorRelativePath;
            if (configuredPath !== undefined && typeof configuredPath !== "string") {
                this.warnOnce(`ioBroker: log mirror disabled: 'ioBrokerLogMirrorRelativePath' must be a string.`);
                return;
            }

            const target = resolveMirrorPath(workspaceFolder.uri.fsPath, configuredPath);
            if (!target) {
                this.warnOnce("ioBroker: log mirror path must stay inside the workspace.");
                return;
            }

            this.maxSizeMb = normalizeMaxSizeMb(cfg.ioBrokerLogMirrorMaxSizeMb);
            this.rotateExistingFile(target);

            fs.mkdirSync(path.dirname(target), { recursive: true });

            let existingSize = 0;
            try {
                existingSize = fs.statSync(target).size;
            } catch {
                existingSize = 0;
            }

            if (!this.isCurrent(gen)) {
                return;
            }

            this.mirrorPath = target;
            this.bytesWritten = existingSize;
            this.openStream(target);
            if (!this.isCurrent(gen)) {
                await this.closeStream();
                return;
            }

            const header = `\n######## ${new Date().toISOString()} — ioBroker javascript log mirror started ########\n`;
            this.writeRaw(header);
        } catch (e) {
            if (this.isCurrent(gen)) {
                this.warnOnce(`ioBroker: log mirror disabled: ${formatError(e)}`);
                await this.disposeAsync();
            } else {
                await this.closeStream();
            }
        }
    }

    write(message: ILogMessage): void {
        if (!this.mirrorStream || this.rotating) {
            if (this.rotating) {
                this.droppedWhileRotating += 1;
            }
            return;
        }
        this.writeRaw(`${formatMirrorLine(message)}\n`);
    }

    dispose(): void {
        this.generation++;
        if (this.mirrorStream) {
            const stream = this.mirrorStream;
            this.mirrorStream = undefined;
            stream.removeAllListeners("error");
            stream.removeAllListeners("drain");
            try {
                stream.end();
            } catch {
                /* ignore */
            }
        }
        this.resetMirrorFields();
    }

    async disposeAsync(): Promise<void> {
        this.generation++;
        await this.closeStream();
        this.resetMirrorFields();
    }

    private isCurrent(gen: number): boolean {
        return gen === this.generation;
    }

    private resetMirrorFields(): void {
        this.mirrorPath = undefined;
        this.bytesWritten = 0;
        this.backpressure = false;
        this.droppedWhileBackpressure = 0;
        this.droppedWhileRotating = 0;
        this.rotating = false;
        this.warnedThisSession = false;
    }

    private writeRaw(chunk: string): void {
        if (!this.mirrorStream || this.rotating) {
            if (this.rotating) {
                this.droppedWhileRotating += 1;
            }
            return;
        }

        if (this.backpressure) {
            this.droppedWhileBackpressure += 1;
            return;
        }

        if (shouldRotate(this.bytesWritten + Buffer.byteLength(chunk), this.maxSizeMb) && this.mirrorPath) {
            this.scheduleRotation();
            this.droppedWhileRotating += 1;
            return;
        }

        try {
            const ok = this.mirrorStream.write(chunk);
            this.bytesWritten += Buffer.byteLength(chunk);
            if (!ok) {
                this.backpressure = true;
            }
        } catch (e) {
            this.warnOnce(`ioBroker: could not write log mirror file: ${formatError(e)}`);
            this.destroyStream();
        }
    }

    private flushBackpressureMarker(): void {
        this.backpressure = false;
        if (this.droppedWhileBackpressure > 0 && this.mirrorStream && !this.rotating) {
            const marker = `${new Date().toISOString()} warn: log mirror dropped ${this.droppedWhileBackpressure} line(s) due to backpressure\n`;
            this.droppedWhileBackpressure = 0;
            try {
                const ok = this.mirrorStream.write(marker);
                this.bytesWritten += Buffer.byteLength(marker);
                if (!ok) {
                    this.backpressure = true;
                }
            } catch {
                this.destroyStream();
            }
        }
    }

    private rotateExistingFile(target: string): void {
        try {
            const size = fs.statSync(target).size;
            if (!shouldRotate(size, this.maxSizeMb)) {
                return;
            }
            this.renameRotated(target);
        } catch {
            /* file may not exist yet */
        }
    }

    private scheduleRotation(): void {
        if (this.rotating || !this.mirrorPath) {
            return;
        }
        this.rotating = true;
        void this.rotateOpenStreamAsync(this.generation);
    }

    private async rotateOpenStreamAsync(gen: number): Promise<void> {
        const target = this.mirrorPath;
        if (!target) {
            this.rotating = false;
            return;
        }

        try {
            await this.closeStream();
            if (!this.isCurrent(gen)) {
                return;
            }

            try {
                this.renameRotated(target);
            } catch (e) {
                this.warnOnce(`ioBroker: log mirror rotation failed: ${formatError(e)}`);
            }

            if (!this.isCurrent(gen)) {
                return;
            }

            this.openStream(target);
            if (!this.isCurrent(gen)) {
                await this.closeStream();
                return;
            }

            this.bytesWritten = 0;
            // Allow writes again before emitting the rotation markers.
            this.rotating = false;
            if (this.droppedWhileRotating > 0) {
                const marker = `${new Date().toISOString()} warn: log mirror dropped ${this.droppedWhileRotating} line(s) during rotation\n`;
                this.droppedWhileRotating = 0;
                this.writeRaw(marker);
            }
            const header = `\n######## ${new Date().toISOString()} — ioBroker javascript log mirror rotated ########\n`;
            this.writeRaw(header);
        } catch (e) {
            if (this.isCurrent(gen)) {
                this.warnOnce(`ioBroker: log mirror rotation failed: ${formatError(e)}`);
                this.destroyStream();
            } else {
                await this.closeStream();
            }
        } finally {
            if (this.isCurrent(gen)) {
                this.rotating = false;
            }
        }
    }

    private renameRotated(target: string): void {
        const rotated = `${target}.1`;
        try {
            fs.unlinkSync(rotated);
        } catch {
            /* ignore missing previous rotation */
        }
        fs.renameSync(target, rotated);
    }

    private openStream(target: string): void {
        this.mirrorStream = fs.createWriteStream(target, { flags: "a" });
        this.mirrorStream.on("error", e => {
            this.warnOnce(`ioBroker: could not write log mirror file: ${e.message}`);
            this.destroyStream();
        });
        this.mirrorStream.on("drain", () => {
            this.flushBackpressureMarker();
        });
    }

    private async closeStream(): Promise<void> {
        if (!this.mirrorStream) {
            return;
        }
        const stream = this.mirrorStream;
        this.mirrorStream = undefined;
        stream.removeAllListeners("error");
        stream.removeAllListeners("drain");
        await endWriteStream(stream);
    }

    private destroyStream(): void {
        if (!this.mirrorStream) {
            return;
        }
        const stream = this.mirrorStream;
        this.mirrorStream = undefined;
        try {
            stream.removeAllListeners();
            stream.destroy();
        } catch {
            /* ignore */
        }
    }

    private warnOnce(message: string): void {
        if (this.warnedThisSession) {
            return;
        }
        this.warnedThisSession = true;
        window.showWarningMessage(message);
    }
}
