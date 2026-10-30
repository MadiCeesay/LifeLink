import React from "react";
import { Text } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useResource } from "../../../hooks/api";
import type { BloodRequest } from "../../../types/api";
import {
  ErrorState,
  Loading,
  Screen,
  Card,
  styles,
} from "../../../components/ui";
import { RequestCard } from "../../../components/RequestCard";
import { Coordination } from "../../../features/facility/Coordination";
import { isActiveRequest, dateText } from "../../../utils/domain";
export default function Detail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useResource<BloodRequest>("/requests/" + id);
  return (
    <Screen
      back
      title="Request coordination"
      onRefresh={() => void q.refetch()}
      refreshing={q.isFetching}
    >
      {q.isPending ? (
        <Loading />
      ) : q.error ? (
        <ErrorState error={q.error} retry={() => void q.refetch()} />
      ) : (
        <>
          <RequestCard request={q.data!} onPress={() => void q.refetch()} />
          <Card>
            <Text style={styles.h3}>
              {q.data!.unitsReceived} of {q.data!.unitsNeeded} units received
            </Text>
            <Text style={styles.muted}>
              Created {dateText(q.data!.createdAt)}
            </Text>
            <Text selectable style={styles.muted}>
              Request ID: {q.data!.id}
            </Text>
            {q.data?.cancellationReason && (
              <Text style={styles.body}>{q.data.cancellationReason}</Text>
            )}
          </Card>
          <Coordination requestId={id} active={isActiveRequest(q.data!)} />
        </>
      )}
    </Screen>
  );
}
