/* eslint-disable @typescript-eslint/naming-convention */
const TYPES = {
    services: {
        config: Symbol.for("ConfigService"),
        connection: Symbol.for("ConnectionService"),
        file: Symbol.for("FileService"),
        command: Symbol.for("CommandService")
    },
    command: Symbol.for("Command")
};

export default TYPES;