import React from "react";
import { RoleTabs } from "../../components/RoleTabs";
export default function Layout() {
  return (
    <RoleTabs
      role="DONOR"
      items={[
        { name: "home", title: "Home", icon: "home-outline" },
        { name: "requests", title: "Requests", icon: "heart-outline" },
        { name: "history", title: "History", icon: "time-outline" },
        { name: "profile", title: "Profile", icon: "person-outline" },
      ]}
    />
  );
}
