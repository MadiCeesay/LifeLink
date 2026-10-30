import React, { useEffect, useRef, useState } from "react";
import { Text } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import { send } from "../../../services/client";
import { useAction, useResource } from "../../../hooks/api";
import type {
  Notification,
  Pagination,
  LocationState,
} from "../../../types/api";
import { submitResponse } from "../../../features/donor/respond";
import { devicePoint } from "../../../services/location";
import {
  Badge,
  Button,
  Card,
  ConfirmationModal,
  Empty,
  ErrorState,
  Loading,
  Screen,
  styles,
} from "../../../components/ui";
import { RequestCard } from "../../../components/RequestCard";
import { isActiveRequest, safetyCopy } from "../../../utils/domain";
export default function Detail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useInfiniteQuery({
    queryKey: ["/notifications", "detail", id],
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      send<{ notifications: Notification[]; pagination: Pagination }>(
        "get",
        "/notifications",
        undefined,
        { page: pageParam, limit: 100 },
      ),
    getNextPageParam: (last) =>
      last.pagination.page < last.pagination.pages
        ? last.pagination.page + 1
        : undefined,
  });
  const n = q.data?.pages
    .flatMap((p) => p.notifications)
    .find((n) => n.id === id);
  const action = useAction();
  const mark = useAction();
  const marked = useRef(false);
  const [status, setStatus] = useState<"ACCEPTED" | "DECLINED" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const loc = useResource<LocationState>("/donors/me/location");
  useEffect(() => {
    if (!n && q.hasNextPage && !q.isFetchingNextPage && !q.isFetchNextPageError)
      void q.fetchNextPage();
  }, [n, q]);
  useEffect(() => {
    if (n?.status === "DELIVERED" && !marked.current) {
      marked.current = true;
      mark.mutate({
        method: "patch",
        url: "/notifications/" + id + "/read",
        body: {},
      });
    }
  }, [n, id, mark]);
  const respond = async () => {
    if (!status || busy) return;
    setBusy(true);
    setError(undefined);
    try {
      await submitResponse(status, {
        refresh: async () => {
          const refreshed = await q.refetch();
          return refreshed.data?.pages
            .flatMap((p) => p.notifications)
            .find((n) => n.id === id);
        },
        consent: async () => {
          const state = await loc.refetch();
          return state.data?.locationSharingEnabled === true;
        },
        location: devicePoint,
        submit: (body) =>
          action.mutateAsync({
            method: "post",
            url: "/notifications/" + id + "/response",
            body,
          }),
      });
      setStatus(null);
      await q.refetch();
    } catch (e) {
      setError(e);
      setStatus(null);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Screen back title="Blood request">
      {q.isPending ? (
        <Loading />
      ) : q.error ? (
        <ErrorState error={q.error} retry={() => void q.refetch()} />
      ) : !n ? (
        q.hasNextPage ? (
          <Loading />
        ) : (
          <Empty title="Notification not available" />
        )
      ) : !n.bloodRequest ? (
        <Empty title="This request is no longer available" />
      ) : (
        <>
          <RequestCard
            request={n.bloodRequest}
            onPress={() => void q.refetch()}
          />
          <Card>
            <Text style={styles.h3}>
              {n.bloodRequest.facility?.name ?? "Healthcare facility"}
            </Text>
            <Text style={styles.body}>{n.bloodRequest.facility?.address}</Text>
            <Text style={styles.muted}>
              A facility sent you this request through LifeLink’s private
              matching workflow.
            </Text>
            <Text style={styles.muted}>{safetyCopy}</Text>
            <Badge value={n.responseStatus} />
            {n.bloodRequest.actionable &&
            isActiveRequest(n.bloodRequest) &&
            n.responseStatus === "PENDING" ? (
              <>
                <Button
                  title="I can donate"
                  disabled={busy}
                  onPress={() => setStatus("ACCEPTED")}
                />
                <Button
                  title="I can’t donate"
                  variant="secondary"
                  disabled={busy}
                  onPress={() => setStatus("DECLINED")}
                />
              </>
            ) : (
              <Text style={styles.muted}>
                Your response is final. Closed requests do not accept new
                responses.
              </Text>
            )}
          </Card>
        </>
      )}
      {mark.error && (
        <ErrorState
          error={mark.error}
          retry={() =>
            mark.mutate({
              method: "patch",
              url: "/notifications/" + id + "/read",
              body: {},
            })
          }
        />
      )}
      {error != null && <ErrorState error={error} />}
      <ConfirmationModal
        visible={status !== null}
        title={
          status === "ACCEPTED"
            ? "Confirm your willingness to respond?"
            : "Decline this request?"
        }
        detail={
          status === "ACCEPTED"
            ? safetyCopy +
              " Your device location will be refreshed using your existing consent."
            : "Your response is final and cannot be changed."
        }
        busy={busy}
        onCancel={() => setStatus(null)}
        onConfirm={() => void respond()}
      />
    </Screen>
  );
}
