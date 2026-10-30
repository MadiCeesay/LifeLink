import React, { useState } from "react";
import { Text } from "react-native";
import * as Crypto from "expo-crypto";
import { useAction } from "../../hooks/api";
import type { Broadcast, Donation, FacilityResponse } from "../../types/api";
import {
  Badge,
  Button,
  Card,
  ConfirmationModal,
  ErrorState,
  ToggleRow,
  styles,
} from "../../components/ui";
import { PagedList } from "../../components/PagedList";
import { DonationCard } from "../donations/HistoryScreen";
import { ContractForm } from "../operations/ContractForm";
import { dateText } from "../../utils/domain";
export function Coordination({
  requestId,
  active,
}: {
  requestId: string;
  active: boolean;
}) {
  const [showResponses, setShowResponses] = useState(false),
    [showDonations, setShowDonations] = useState(false),
    [expand, setExpand] = useState(false),
    [confirm, setConfirm] = useState(false);
  const [key, setKey] = useState<string | null>(null);
  const action = useAction<Broadcast>();
  const [result, setResult] = useState<Broadcast | null>(null);
  const broadcast = async () => {
    const operationKey = key ?? Crypto.randomUUID();
    setKey(operationKey);
    try {
      const r = await action.mutateAsync({
        method: "post",
        url: "/requests/" + requestId + "/broadcast",
        body: { idempotencyKey: operationKey, expand },
      });
      setResult(r);
      setKey(null);
      setConfirm(false);
    } catch {
      setConfirm(false);
    }
  };
  return (
    <>
      <Card>
        <Text style={styles.h3}>Private donor coordination</Text>
        <Text style={styles.muted}>
          Requires Manage blood requests. The server selects donors and controls
          radius stages. No exact donor locations are returned.
        </Text>
        {active && (
          <>
            <ToggleRow
              title="Expand to the next stage"
              detail="Use only after an initial broadcast. The server controls the next permitted stage."
              value={expand}
              disabled={action.isPending || key !== null}
              onChange={setExpand}
            />
            <Button
              title={key ? "Retry same broadcast" : "Broadcast request"}
              loading={action.isPending}
              onPress={() => setConfirm(true)}
            />
          </>
        )}
        {result && (
          <Text style={styles.body}>
            {result.notifiedCount} notifications sent · {result.radiusUsedKm} km
            stage
          </Text>
        )}
        {action.error && <ErrorState error={action.error} />}
        <Button
          title={showResponses ? "Hide responses" : "View responses"}
          variant="secondary"
          onPress={() => setShowResponses(!showResponses)}
        />
      </Card>
      {showResponses && (
        <PagedList<FacilityResponse>
          url={"/requests/" + requestId + "/responses"}
          field="responses"
          empty="No donor responses yet."
          render={(r) => (
            <Card>
              <Badge value={r.status} />
              <Text style={styles.muted}>{dateText(r.respondedAt)}</Text>
              {r.donor ? (
                <>
                  <Text style={styles.h3}>{r.donor.name}</Text>
                  <Text style={styles.body}>{r.donor.phone}</Text>
                  <Text style={styles.muted}>
                    {r.donor.verifiedBloodType} · Donor ID: {r.donor.id}
                  </Text>
                </>
              ) : (
                <Text style={styles.muted}>
                  Contact information is not available for this response.
                </Text>
              )}
            </Card>
          )}
        />
      )}
      <Card>
        <Text style={styles.h3}>Confirmed donations</Text>
        <Text style={styles.muted}>Requires Confirm donations permission.</Text>
        <Button
          title={showDonations ? "Hide donations" : "View confirmed donations"}
          variant="secondary"
          onPress={() => setShowDonations(!showDonations)}
        />
      </Card>
      {showDonations && (
        <PagedList<Donation>
          url={"/requests/" + requestId + "/donations"}
          field="donations"
          empty="No confirmed donations for this request."
          render={(d) => <DonationCard donation={d} />}
        />
      )}
      {active && (
        <>
          <ContractForm
            schema="DonationInput"
            method="post"
            url={"/requests/" + requestId + "/donations"}
            title="Confirm actual donation"
            detail="Requires Confirm donations. Record only an actual completed donation from an accepted donor. Verify donor, request and units before confirming. Units are an operational record, not a medical volume recommendation."
          />
          <ContractForm
            schema="Reason"
            method="patch"
            url={"/requests/" + requestId + "/cancel"}
            title="Cancel this request"
            detail="Requires Manage blood requests. This closes the request to further responses and donations."
          />
        </>
      )}
      <ConfirmationModal
        visible={confirm}
        title={
          expand
            ? "Expand this request broadcast?"
            : "Send this request to matched donors?"
        }
        detail="Only matching donors selected by the server will receive an in-app notification. Repeated retries use the same operation key."
        busy={action.isPending}
        onCancel={() => setConfirm(false)}
        onConfirm={() => void broadcast()}
      />
    </>
  );
}
