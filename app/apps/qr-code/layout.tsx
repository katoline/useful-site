import { Outlet } from "react-router";
import { Shell } from "~/platform/shell/Shell";
import { manifest } from "./manifest";

export default function QrCodeLayout() {
  return (
    <Shell config={{ appPath: manifest.path, name: manifest.name, menu: manifest.menu }}>
      <Outlet />
    </Shell>
  );
}
