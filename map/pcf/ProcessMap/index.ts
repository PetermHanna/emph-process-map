import { IInputs, IOutputs } from "./generated/ManifestTypes";
import * as React from "react";
import { createRoot, Root } from "react-dom/client";
import { Shell } from "./src/ui/Shell";
import { DataverseGateway } from "./src/data/api";

export class ProcessMap implements ComponentFramework.StandardControl<IInputs, IOutputs> {
  private root: Root | null = null;

  public init(context: ComponentFramework.Context<IInputs>, _notify: () => void, _state: ComponentFramework.Dictionary, container: HTMLDivElement): void {
    container.style.width = "100%";
    this.root = createRoot(container);
    const mode = context.mode as ComponentFramework.Mode & { setFullScreen?: (on: boolean) => void };
    const fullScreen = { supported: typeof mode.setFullScreen === "function", set: (on: boolean) => mode.setFullScreen?.(on) };
    const user = { id: context.userSettings?.userId || null, name: context.userSettings?.userName || "" };
    this.root.render(React.createElement(Shell, { gateway: new DataverseGateway(context.webAPI), user, fullScreen }));
  }

  public updateView(): void { /* the app loads and saves its own data */ }
  public getOutputs(): IOutputs { return {}; }
  public destroy(): void { this.root?.unmount(); }
}
