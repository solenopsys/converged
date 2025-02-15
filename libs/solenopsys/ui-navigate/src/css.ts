export function css(file: any, className: string) {
    const name=className.replace(/\./g, "")
    if (typeof file === "string") {
        return name;
    }
    if (typeof file === "object") {
        return file[name];
    }

}