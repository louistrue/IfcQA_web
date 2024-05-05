import * as WEBIFC from "web-ifc";
import { IfcAlignmentData } from "bim-fragment";
export declare class CivilReader {
    read(webIfc: WEBIFC.IfcAPI): {
        horizontalAlignments: IfcAlignmentData;
        verticalAlignments: IfcAlignmentData;
        realAlignments: IfcAlignmentData;
    } | undefined;
    get(civilItems: any): {
        horizontalAlignments: IfcAlignmentData;
        verticalAlignments: IfcAlignmentData;
        realAlignments: IfcAlignmentData;
    } | undefined;
}
