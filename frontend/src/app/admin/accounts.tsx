import React, { useState } from "react";
import { Text } from "react-native";
import { useAuth } from "../../providers/AuthProvider";
import { Button, Card, Field, Screen, styles } from "../../components/ui";
import { ContractForm } from "../../features/operations/ContractForm";
export default function Accounts() {
  const a = useAuth();
  const [input, setInput] = useState(""),
    [id, setId] = useState("");
  return (
    <Screen
      back
      title="Account controls"
      subtitle="Use a known exact account ID. There is no public account directory."
    >
      <Card>
        <Field
          label="Account ID"
          value={input}
          onChangeText={setInput}
          autoCapitalize="none"
        />
        <Button
          title="Select account"
          disabled={
            !/^[a-fA-F0-9]{24}$/.test(input) ||
            input.toLowerCase() === a.user?.id.toLowerCase()
          }
          onPress={() => setId(input)}
        />
        <Text style={styles.muted}>
          You cannot use this screen to change your own account status.
        </Text>
      </Card>
      {id && (
        <>
          <Text selectable style={styles.body}>
            Selected account: {id}
          </Text>
          <ContractForm
            key={id}
            schema="AccountStatusInput"
            method="patch"
            url={"/admin/accounts/" + id + "/status"}
            title="Update account status"
            detail="Changing account status invalidates previous sessions. Confirm the exact ID and intended active state."
          />
        </>
      )}
    </Screen>
  );
}
