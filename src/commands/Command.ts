export interface Command {
    id: string;
    execute(...args: any[]): any;
}