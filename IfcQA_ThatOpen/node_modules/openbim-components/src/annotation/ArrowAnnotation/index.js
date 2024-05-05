import { BaseSVGAnnotation, UIElement } from "../../base-types";
import { Button } from "../../ui";
import { SVGArrow } from "../SVGArrow";
import { DrawManager } from "../DrawManager";
export class ArrowAnnotation extends BaseSVGAnnotation {
    constructor(components) {
        super(components);
        this.name = "ArrowAnnotation";
        this.canvas = null;
        this.uiElement = new UIElement();
        this.cancel = () => {
            if (!this._isDrawing) {
                return;
            }
            this._isDrawing = false;
            this._previewElement.reset();
            this._previewElement.get().remove();
        };
        this.start = (event) => {
            if (!this.canDraw) {
                return null;
            }
            const drawManager = this.components.tools.get(DrawManager);
            if (!this._isDrawing) {
                this._isDrawing = true;
                this._previewElement.setStyle(drawManager.viewport.config);
                this._previewElement.x1 = event.clientX;
                this._previewElement.y1 = event.clientY;
                this._previewElement.x2 = event.clientX;
                this._previewElement.y2 = event.clientY;
                this.svgViewport?.append(this._previewElement.get());
            }
            else {
                const arrow = this._previewElement.clone();
                arrow.setStyle(drawManager.viewport.config);
                this.svgViewport?.append(arrow.get());
                this.cancel();
                return arrow;
            }
            return null;
        };
        this.draw = (e) => {
            if (!this.canDraw || !this._isDrawing) {
                return;
            }
            this._previewElement.x1 = e.clientX;
            this._previewElement.y1 = e.clientY;
        };
        this._previewElement = new SVGArrow(components);
        const drawManager = this.components.tools.get(DrawManager);
        if (components.uiEnabled) {
            this.setUI();
        }
        drawManager.addDrawingTool(this.name, this);
    }
    setUI() {
        const drawManager = this.components.tools.get(DrawManager);
        const main = new Button(this.components);
        main.label = "Arrow";
        main.materialIcon = "north_east";
        main.onClick.add(() => {
            drawManager.activateTool(this);
        });
        this.uiElement.set({ main });
    }
    async dispose() {
        await super.dispose();
        this._previewElement.dispose();
    }
}
//# sourceMappingURL=index.js.map