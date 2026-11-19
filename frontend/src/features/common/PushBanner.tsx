import React, { useEffect, useState } from "react";
import { Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { BigButton, font, errorText } from "../../components/kit";
import { enablePush, pushState, type PushState } from "../../services/push";
import { colors as c } from "../../theme";
/** Asks people to switch on phone alerts — the single most important setting for emergencies. */
export function PushBanner({ who = "donor" }: { who?: "donor" | "staff" }) {
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  useEffect(() => {
    let live = true;
    void pushState().then((s) => live && setState(s));
    return () => {
      live = false;
    };
  }, []);
  if (!state || state === "on" || state === "unsupported") return null;
  const text =
    state === "needs-install"
      ? "To get alerts on iPhone: tap Share, then “Add to Home Screen”, and open LifeLink from there."
      : state === "denied"
        ? "Alerts are blocked. Allow notifications for LifeLink in your phone or browser settings."
        : who === "donor"
          ? "Turn on alerts so we can reach you when someone needs your blood — even when the app is closed."
          : "Turn on alerts to know the moment a donor says they're coming.";
  return (
    <View style={{ backgroundColor: "#FFF4E0", borderRadius: 18, padding: 16, gap: 12 }}>
      <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
        <Ionicons name="notifications" size={24} color="#8A5300" />
        <Text style={{ flex: 1, fontFamily: font.semibold, fontSize: 15, lineHeight: 21, color: "#5C3A00" }}>{text}</Text>
      </View>
      {state === "off" && (
        <BigButton
          title="Turn on alerts"
          size="medium"
          loading={busy}
          onPress={async () => {
            setBusy(true);
            setError(undefined);
            try {
              setState(await enablePush());
            } catch (e) {
              setError(errorText(e));
            } finally {
              setBusy(false);
            }
          }}
        />
      )}
      {error ? <Text style={{ fontFamily: font.regular, color: c.primaryDark }}>{error}</Text> : null}
    </View>
  );
}
