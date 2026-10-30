import React, { useState } from "react";
import { Text } from "react-native";
import { PagedList } from "../../components/PagedList";
import { Card, Screen, Field, Button, styles } from "../../components/ui";
import type { AuditLog } from "../../types/api";
import { dateText, label } from "../../utils/domain";
export function ActivityScreen() {
  const [input, setInput] = useState(""),
    [actor, setActor] = useState("");
  return (
    <Screen title="Audit activity" subtitle="Read-only operational history.">
      <Card>
        <Field
          label="Actor ID filter (optional)"
          value={input}
          onChangeText={setInput}
          autoCapitalize="none"
        />
        <Button
          title="Apply filter"
          variant="secondary"
          disabled={!!input && !/^[a-fA-F0-9]{24}$/.test(input)}
          onPress={() => setActor(input)}
        />
      </Card>
      <PagedList<AuditLog>
        key={actor}
        url="/admin/audit-logs"
        params={actor ? { actor } : undefined}
        field="auditLogs"
        empty="No audit events match this view."
        render={(a) => (
          <Card>
            <Text style={styles.h3}>{label(a.action)}</Text>
            <Text style={styles.muted}>{dateText(a.timestamp)}</Text>
            <Text selectable style={styles.muted}>
              Actor: {a.actor} · {label(a.actorRole)}
            </Text>
            <Text selectable style={styles.muted}>
              {a.targetType}: {a.targetId}
            </Text>
            {Object.entries(a.metadata).map(([key, value]) => (
              <Text key={key} style={styles.body}>
                {label(key)}:{" "}
                {Array.isArray(value)
                  ? value.map(label).join(", ")
                  : String(value)}
              </Text>
            ))}
          </Card>
        )}
      />
    </Screen>
  );
}
