import React from "react";
import { RoleTabs } from "../../components/RoleTabs";
export default function Layout() {
  return (
    <RoleTabs
      role="ADMIN"
      items={[
        { name: "overview", title: "Overview", icon: "grid-outline" },
        { name: "facilities", title: "Facilities", icon: "business-outline" },
        { name: "activity", title: "Activity", icon: "list-outline" },
        { name: "more", title: "More", icon: "ellipsis-horizontal" },
      ]}
    />
  );
}
