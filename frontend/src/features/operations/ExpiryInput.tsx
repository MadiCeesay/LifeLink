import React, { useState } from "react";
import { Text, View } from "react-native";
import { Choices, styles } from "../../components/ui";
import { dateText } from "../../utils/domain";
export function ExpiryInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [hours, setHours] = useState("");
  return (
    <View style={{ gap: 8 }}>
      <Choices
        label="Expires in (hours)"
        options={["1", "6", "12", "24", "48"]}
        value={value ? hours : ""}
        onChange={(h) => {
          setHours(h);
          onChange(new Date(Date.now() + Number(h) * 3600000).toISOString());
        }}
      />
      {value && (
        <Text style={styles.muted}>
          Expires {dateText(value)}. The facility’s configured request lifetime
          still applies.
        </Text>
      )}
    </View>
  );
}
