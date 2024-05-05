import { IfcFragmentSettings } from "../../FragmentIfcLoader/src";
/** Configuration of the IFC-fragment streaming. */
export declare class IfcStreamingSettings extends IfcFragmentSettings {
    minGeometrySize: number;
    minAssetsSize: number;
}
/** Configuration of the IFC-fragment streaming. */
export declare class PropertiesStreamingSettings extends IfcFragmentSettings {
    propertiesSize: number;
}
