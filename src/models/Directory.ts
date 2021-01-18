import { Script } from "./Script";

export class Directory {
    constructor(public directories: Directory[], public scripts: Script[])
    {}
}