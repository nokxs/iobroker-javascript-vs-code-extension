import { env, Uri, window } from "vscode";

import { inject, injectable } from "inversify";
import { AdminVersion, Config, NoConfig } from '../../models/Config';
import { NoWorkspaceFolder } from '../../models/NoWorkspaceFolder';
import TYPES from '../../Types';
import { ILogService } from '../log/ILogService';
import { IWorkspaceService } from '../workspace/IWorkspaceService';
import { IIobrokerConnectionService } from "./IIobrokerConnectionService";
import { IConnectionEventListener } from "../connection/IConnectionEventListener";
import { IConfigRepositoryService } from "../configRepository/IConfigRepositoryService";
import { IConfigCreationService } from "../configCreation/IConfigCreationService";
import { IScriptService } from "../script/IScriptService";
import { IScriptRepositoryService } from "../scriptRepository/IScriptRepositoryService";
import { IConnectionServiceProvider } from "../connectionServiceProvider/IConnectionServiceProvider";
import { ILoginService } from "../loginHttpClient/ILoginService";
import { ILoginCredentialsService } from "../loginCredentialsService/ILoginCredentialsService";
import { IDebugLogService } from "../debugLogService/IDebugLogService";
import { IStatusBarService } from "../statusBar/IStatusBarService";
import { IWindowMessageService } from "../windowMessage/IWindowMessageService";
import { IObjectRepositoryService } from "../StateRepository/IObjectRepositoryService";
import { IStateAndObjectRemoteService } from "../stateRemote/IStateAndObjectRemoteService";
import { IAutoUploadService } from "../autoUpload/IAutoUploadService";
import { LoginType } from "../loginHttpClient/LoginType";

@injectable()
export class IobrokerConnectionService implements IIobrokerConnectionService, IConnectionEventListener {

    config: Config = new NoConfig();

    private isReAuthenticationRunning = false;

    constructor(
        @inject(TYPES.services.configCreation) private configCreationService: IConfigCreationService,
        @inject(TYPES.services.configRepository) private configRepository: IConfigRepositoryService,
        @inject(TYPES.services.connectionServiceProvider) private connectionServiceProvider: IConnectionServiceProvider,
        @inject(TYPES.services.workspace) private workspaceService: IWorkspaceService,
        @inject(TYPES.services.log) private logService: ILogService,
        @inject(TYPES.services.script) private scriptService: IScriptService,
        @inject(TYPES.services.scriptRepository) private scriptRepositoryService: IScriptRepositoryService,
        @inject(TYPES.services.login) private loginService: ILoginService,
        @inject(TYPES.services.loginCredentials) private loginCredentialService: ILoginCredentialsService,
        @inject(TYPES.services.debugLogService) private debugLogService: IDebugLogService,
        @inject(TYPES.services.statusBarService) private statusBarService: IStatusBarService,
        @inject(TYPES.services.windowMessageService) private windowMessageService: IWindowMessageService,
        @inject(TYPES.services.objectRepositoryService) private objectRepositoryService: IObjectRepositoryService,
        @inject(TYPES.services.stateAndObjectRemoteService) private stateAndObjectRemoteService: IStateAndObjectRemoteService,
        @inject(TYPES.services.autoUploadService) private autoUploadService: IAutoUploadService
    ) {
        statusBarService.init();
    }

    onConnected(): void {
        this.statusBarService.setText("$(check) ioBroker connected");
    }

    onDisconnected(): void {
        this.statusBarService.setText("$(warning) ioBroker disconnected");
    }

    async onReAuthenticate(): Promise<void> {
        this.debugLogService.log("start reAuthentication", "IobrokerConnectionService");

        if (!this.isReAuthenticationRunning) {
            this.debugLogService.log("reAuthentication not running", "IobrokerConnectionService");
            this.isReAuthenticationRunning = true;
            this.statusBarService.setText("$(warning) ioBroker disconnected (authentication required)");
            await this.loginCredentialService.updatePasswordFromUser();
            await this.connect(true); // force login
            this.isReAuthenticationRunning = false;
            this.debugLogService.log("reAuthentication done", "IobrokerConnectionService");
        }
    }

    isConnected(): boolean {
        return this.connectionServiceProvider.isConnectionServiceAvailable() && this.connectionServiceProvider.getConnectionService().isConnected;
    }

    async connect(forceLogin: boolean = false): Promise<void> {
        try {
            let isInitialConnect = false;
            let workspaceFolder = await this.workspaceService.getWorkspaceToUse();

            if (workspaceFolder instanceof NoWorkspaceFolder) {
                this.windowMessageService.showError("Cannot continue execution of extension 'ioBroker.javascript', because no valid workspace was selected. Exiting.");
                return;
            }

            this.config = await this.configRepository.read(workspaceFolder);
            this.logDebug(`read config: ${JSON.stringify(this.config)}`);

            if (!(this.config instanceof NoConfig) && !this.isConfigValid()) {
                this.logDebug("Config is invalid");
                const pickAnswer = await window.showQuickPick(["Yes", "No", "No, open documentation"], { placeHolder: "ioBroker: Your config is missing mandatory items. Recreate config?", ignoreFocusOut: true });
                if (pickAnswer === "Yes") {
                    this.logDebug("Config shall be recreated");
                    this.config = new NoConfig();
                }
                else if (pickAnswer === "No, open documentation") {
                    await env.openExternal(Uri.parse("https://github.com/nokxs/iobroker-javascript-vs-code-extension#available-settings"));
                    this.windowMessageService.showWarning("Connection attempt to ioBroker aborted. Update your config and try again!");
                    this.logDebug("Abort connection attempt and open documentation");
                    return;
                }
            }

            if (this.config instanceof NoConfig) {
                this.logDebug("Creating config interactively");
                this.config = await this.configCreationService.createConfigInteractivly();
                if (this.config instanceof NoConfig) {
                    this.windowMessageService.showWarning("ioBroker: Config not saved. Execute command 'iobroker: Connect to ioBroker' to start another connection attempt.");
                    this.logDebug("Interactive config creation aborted");
                    return;
                }
                else {
                    await this.configRepository.write(this.config, workspaceFolder);
                    this.statusBarService.setStatusBarMessage("ioBroker: Created new 'iobroker-config.json' in root directory");
                    isInitialConnect = true;
                    this.logDebug("New config created");
                }
            }

            this.connectionServiceProvider.getConnectionService().registerConnectionEventListener(this);
            const connectionService = this.connectionServiceProvider.getConnectionService();
            const useAutoReconnect = this.config?.autoReconnect ?? true;
            const allowSelfSignedCertificate = this.config.allowSelfSignedCertificate ?? false;
            const uri = Uri.parse(`${this.config.ioBrokerUrl}:${this.config.socketIoPort}`);
            
            this.logDebug(`Connection Url is '${uri}'`);

            if (allowSelfSignedCertificate) {
                process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';
                this.logDebug("Self signed certificates are allowed for connecting to iobroker");
            }

            if (this.config.forceLogin) {
                this.logDebug("Login is forced and login detection therefore skipped");
                forceLogin = true;
            }
            
            this.logDebug(`Force login: ${forceLogin}`);

            const loginType = forceLogin ? LoginType.oAuth2 : await this.loginService.getLoginType(uri, allowSelfSignedCertificate);
            if (forceLogin || loginType !== LoginType.noLogin) {
                this.logDebug(`Login is necessary`);

                if (!this.config.username) {
                    this.windowMessageService.showWarning("ioBroker: Login to ioBroker necessary, but no user name is set. Add property 'username' to .iobroker-config.json and try again!");
                    return;
                }

                const token = await this.loginService.getAccessToken(uri, allowSelfSignedCertificate, this.config.username, loginType);
                if (!token) {
                    this.windowMessageService.showWarning("ioBroker: Could not login to ioBroker. Is user name and password correct?");
                    return;
                }

                await connectionService.connectWithToken(uri, useAutoReconnect, allowSelfSignedCertificate, token, this.config.username);
            }
            else {
                this.logDebug("Login not necessary. Connecting to iobroker...");
                await connectionService.connect(uri, useAutoReconnect, allowSelfSignedCertificate);
            }

            this.logDebug("Connection to iobroker successful. Initializing extension...");

            this.logDebug("Start receiving log messages...");
            await this.logService.startReceiving();

            this.logDebug("Initialize internal script repository...");
            await this.scriptRepositoryService.init();

            this.logDebug("Initialize internal object repository...");
            await this.objectRepositoryService.init();

            this.logDebug("Initialze remove services...");
            this.stateAndObjectRemoteService.init();

            if (this.config.autoUpload) {
                this.logDebug("Auto Upload feature is initialized");
                this.autoUploadService.init();
            }

            if (isInitialConnect) {
                this.logDebug("This is the initial connect. Ask to download all scripts");
                const answer = await window.showQuickPick(["Yes", "No"], { placeHolder: "Download all scripts" });
                if (answer === "Yes") {
                    this.logDebug("All scripts will be downloaded...");
                    const scripts = this.scriptRepositoryService.getAllScripts();
                    await this.scriptService.saveAllToFile(scripts);
                    await this.scriptRepositoryService.evaluateScriptOnRemoteForAllScripts();
                    await this.scriptRepositoryService.evaluateDirtyStateForAllScripts();
                    this.logDebug("All scripts downloaded");
                }
            }
        } catch (error) {
            this.logDebug("Connection was not possible due to erorr: " + JSON.stringify(error));
            this.windowMessageService.showError(`Could not connect to ioBroker. Check your '.iobroker-config.json' for wrong configuration: ${error}`);
        }
    }

    private isConfigValid(): boolean {
        if (
            !this.config.ioBrokerUrl ||
            !this.config.socketIoPort ||
            !this.config.scriptRoot ||
            !this.config.adminVersion || this.config.adminVersion === AdminVersion.unknown
        ) {
            return false;
        }

        return true;
    }

    private logDebug(message: string) {
        this.debugLogService.log(message, "IobrokerConnectionService");
    }
}
