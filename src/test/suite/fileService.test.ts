import * as assert from "assert";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { Uri } from "vscode";
import { FileService } from "../../services/file/FileService";

suite("FileService", () => {
    let rootPath: string;

    setup(() => {
        rootPath = fs.mkdtempSync(path.join(os.tmpdir(), "iobroker-file-service-"));
    });

    teardown(() => {
        fs.rmdirSync(rootPath, { recursive: true });
    });

    test("createDirectory creates missing parent folders", async () => {
        const folder = Uri.file(path.join(rootPath, "a", "b", "c"));

        await new FileService().createDirectory(folder);

        assert.strictEqual(fs.statSync(folder.fsPath).isDirectory(), true);
    });

    test("createDirectory does not fail for an existing folder", async () => {
        const folder = Uri.file(path.join(rootPath, "existing"));
        const fileService = new FileService();
        await fileService.createDirectory(folder);

        await fileService.createDirectory(folder);

        assert.strictEqual(fs.statSync(folder.fsPath).isDirectory(), true);
    });

    test("deleteDirectory removes the folder and its content", async () => {
        const folder = Uri.file(path.join(rootPath, "nested"));
        fs.mkdirSync(path.join(folder.fsPath, "child"), { recursive: true });
        fs.writeFileSync(path.join(folder.fsPath, "child", "file.txt"), "x");

        await new FileService().deleteDirectory(folder);

        assert.strictEqual(fs.existsSync(folder.fsPath), false);
    });

    test("deleteDirectory does not fail when the folder is already gone", async () => {
        const folder = Uri.file(path.join(rootPath, "missing"));

        await new FileService().deleteDirectory(folder);

        assert.strictEqual(fs.existsSync(folder.fsPath), false);
    });

    test("deleteDirectory rejects when the path is not a folder", async () => {
        const fileUri = Uri.file(path.join(rootPath, "file.txt"));
        fs.writeFileSync(fileUri.fsPath, "x");

        await assert.rejects(new FileService().deleteDirectory(fileUri));

        assert.strictEqual(fs.existsSync(fileUri.fsPath), true);
    });
});
