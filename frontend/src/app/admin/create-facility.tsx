import React from "react";
import { router } from "expo-router";
import { Screen } from "../../components/ui";
import { ContractForm } from "../../features/operations/ContractForm";
import type { Facility } from "../../types/api";
export default function Create() {
  return (
    <Screen back title="Create pending facility">
      <ContractForm
        schema="FacilityCreate"
        method="post"
        url="/admin/facilities"
        title="Create pending facility"
        onSuccess={(data) =>
          router.replace({
            pathname: "/admin/facility/[id]",
            params: { id: (data as Facility).id },
          })
        }
      />
    </Screen>
  );
}
