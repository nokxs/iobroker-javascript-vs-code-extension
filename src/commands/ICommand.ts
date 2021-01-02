export interface ICommand {
    id: string;
    execute(...args: any[]): any;
}
