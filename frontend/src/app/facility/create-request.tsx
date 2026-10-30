import React from "react";
import { router } from "expo-router";
import { Screen } from "../../components/ui";
import { ContractForm } from "../../features/operations/ContractForm";
import type { BloodRequest } from "../../types/api";
export default function Create() {
  return (
    <Screen
      back
      title="Create blood request"
      subtitle="Requires Create blood requests permission."
    >
      <ContractForm
        schema="RequestCreate"
        method="post"
        url="/requests"
        title="Create request"
        detail="Use your facility's official location. Do not include patient identity or medical records. Expiry must be within the server's configured limit."
        onSuccess={(data) =>
          router.replace({
            pathname: "/facility/request/[id]",
            params: { id: (data as BloodRequest).id },
          })
        }
      />
    </Screen>
  );
}
