import React from "react";
import { RoleTabs } from "../../components/RoleTabs";
export default function Layout() {
  return (
    <RoleTabs
      role="FACILITY_USER"
      items={[
        { name: "home", title: "Home", icon: "home-outline" },
        { name: "requests", title: "Requests", icon: "heart-outline" },
        { name: "verify", title: "Scan", icon: "qr-code-outline" },
        { name: "more", title: "More", icon: "grid-outline" },
      ]}
    />
  );
}
