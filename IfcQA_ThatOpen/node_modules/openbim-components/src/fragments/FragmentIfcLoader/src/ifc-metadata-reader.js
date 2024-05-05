export class IfcMetadataReader {
    get(webIfc, type) {
        let description = "";
        const descriptionData = webIfc.GetHeaderLine(0, type) || "";
        if (!descriptionData)
            return description;
        for (const arg of descriptionData.arguments) {
            if (arg === null || arg === undefined) {
                continue;
            }
            if (Array.isArray(arg)) {
                for (const subArg of arg) {
                    description += `${subArg.value}|`;
                }
            }
            else {
                description += `${arg.value}|`;
            }
        }
        return description;
    }
}
//# sourceMappingURL=ifc-metadata-reader.js.map