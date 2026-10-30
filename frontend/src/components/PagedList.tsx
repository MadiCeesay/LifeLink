import React, { useState } from "react";
import { Text, View } from "react-native";
import { useResource } from "../hooks/api";
import type { Pagination } from "../types/api";
import { Button, Empty, ErrorState, Loading, styles } from "./ui";
export function PagedList<T>({
  url,
  field,
  render,
  empty,
  params,
}: {
  url: string;
  field: string;
  render: (item: T) => React.ReactNode;
  empty: string;
  params?: Record<string, string>;
}) {
  const [page, setPage] = useState(1);
  const q = useResource<Record<string, T[] | Pagination>>(url, {
    ...params,
    page,
    limit: 20,
  });
  if (q.isPending) return <Loading />;
  if (q.error)
    return <ErrorState error={q.error} retry={() => void q.refetch()} />;
  const rows = (q.data?.[field] as T[]) ?? [];
  const pagination = q.data?.pagination as Pagination;
  return (
    <View style={{ gap: 16 }}>
      {rows.length ? (
        rows.map((row, i) => (
          <React.Fragment key={(row as { id?: string }).id ?? i}>
            {render(row)}
          </React.Fragment>
        ))
      ) : (
        <Empty title={empty} />
      )}
      <View style={styles.between}>
        <Button
          title="Previous"
          variant="secondary"
          disabled={page === 1 || q.isFetching}
          onPress={() => setPage(page - 1)}
        />
        <Text style={styles.muted}>
          Page {page} / {Math.max(1, pagination?.pages ?? 1)}
        </Text>
        <Button
          title="Next"
          variant="secondary"
          disabled={!pagination || page >= pagination.pages || q.isFetching}
          onPress={() => setPage(page + 1)}
        />
      </View>
      <Button
        title="Refresh"
        variant="text"
        onPress={() => void q.refetch()}
        loading={q.isFetching}
      />
    </View>
  );
}
