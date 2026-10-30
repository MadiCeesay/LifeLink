import React, { useState } from "react";
import { Text } from "react-native";
import {
  Button,
  Card,
  Field,
  Screen,
  Badge,
  styles,
} from "../../components/ui";
import { ContractForm } from "../../features/operations/ContractForm";
import { PagedList } from "../../components/PagedList";
import type { VerificationEvent } from "../../types/api";
import { dateText } from "../../utils/domain";
export default function Oversight() {
  const [input, setInput] = useState(""),
    [id, setId] = useState("");
  return (
    <Screen back title="Verification oversight">
      <Card>
        <Field
          label="Exact donor ID"
          value={input}
          onChangeText={setInput}
          autoCapitalize="none"
        />
        <Button
          title="Open verification oversight"
          disabled={!/^[a-fA-F0-9]{24}$/.test(input)}
          onPress={() => setId(input)}
        />
      </Card>
      {id && (
        <>
          <ContractForm
            key={id}
            schema="VerificationStatusInput"
            method="patch"
            url={"/admin/donors/" + id + "/verification-status"}
            title="Update verification status"
            detail="Administrative oversight can suspend or require reverification. It cannot establish a trusted blood group."
          />
          <PagedList<VerificationEvent>
            url={"/admin/donors/" + id + "/verification-history"}
            field="events"
            empty="No verification history."
            render={(e) => (
              <Card>
                <Badge value={e.newStatus} />
                <Text style={styles.muted}>{dateText(e.timestamp)}</Text>
                <Text style={styles.body}>
                  {e.reason ?? e.notes ?? "Profile verification recorded"}
                </Text>
              </Card>
            )}
          />
        </>
      )}
    </Screen>
  );
}
