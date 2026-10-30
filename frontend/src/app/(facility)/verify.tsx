import React, { useState } from "react";
import { Text } from "react-native";
import { useResource } from "../../hooks/api";
import type { DonorLookup, VerificationEvent } from "../../types/api";
import {
  Badge,
  Button,
  Card,
  Field,
  Screen,
  ErrorState,
  Loading,
  styles,
} from "../../components/ui";
import { ContractForm } from "../../features/operations/ContractForm";
import { PagedList } from "../../components/PagedList";
import { dateText } from "../../utils/domain";
export default function Verify() {
  const [input, setInput] = useState("");
  const [id, setId] = useState("");
  const [invalid, setInvalid] = useState(false);
  const q = useResource<DonorLookup>(
    "/donors/" + id + "/verification",
    undefined,
    !!id,
  );
  return (
    <Screen
      title="Verify a donor"
      subtitle="Requires Verify donors permission. Use the donor's exact LifeLink ID."
    >
      <Card>
        <Field
          label="Donor ID"
          value={input}
          onChangeText={setInput}
          autoCapitalize="none"
          error={invalid ? "Enter the full 24-character donor ID." : undefined}
        />
        <Button
          title="Look up donor for verification"
          onPress={() => {
            const valid = /^[a-fA-F0-9]{24}$/.test(input.trim());
            setInvalid(!valid);
            if (valid) setId(input.trim());
          }}
        />
      </Card>
      {id &&
        (q.isPending ? (
          <Loading />
        ) : q.error ? (
          <ErrorState error={q.error} retry={() => void q.refetch()} />
        ) : (
          <>
            <Card>
              <Text style={styles.h2}>{q.data?.name}</Text>
              <Badge value={q.data!.verificationStatus} />
              <Text style={styles.body}>
                {q.data?.verifiedBloodType ?? "Blood group not yet verified"}
              </Text>
            </Card>
            <ContractForm
              key={id}
              schema="VerificationInput"
              method="patch"
              url={"/donors/" + id + "/verification"}
              title="Record donor verification"
              detail="Record only after professional profile/blood-group verification. This does not certify current medical fitness."
            />
            <PagedList<VerificationEvent>
              url={"/donors/" + id + "/verification-history"}
              field="events"
              empty="No verification events from your facility."
              render={(e) => (
                <Card>
                  <Badge value={e.newStatus} />
                  <Text style={styles.muted}>{dateText(e.timestamp)}</Text>
                  <Text style={styles.body}>{e.verifiedBloodType}</Text>
                  {e.notes && <Text style={styles.muted}>{e.notes}</Text>}
                </Card>
              )}
            />
          </>
        ))}
    </Screen>
  );
}
