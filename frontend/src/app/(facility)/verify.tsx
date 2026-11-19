import React, { useState } from "react";
import { Text, TextInput, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { send } from "../../services/client";
import type { DonorLookup } from "../../types/api";
import { BigButton, Body, Box, Choice, H1, H3, Notice, Page, displayType, errorText, font } from "../../components/kit";
import { colors as c } from "../../theme";
import { bloodTypes, label } from "../../utils/domain";
import { parseDonorCode } from "../../utils/qr";
function Scanner({ onCode }: { onCode: (raw: string) => void }) {
  const [permission, requestPermission] = useCameraPermissions();
  if (!permission) return <Body muted>Starting camera…</Body>;
  if (!permission.granted)
    return (
      <Box>
        <Body>LifeLink needs the camera to scan donor cards.</Body>
        <BigButton title="Allow camera" icon="camera-outline" size="medium" onPress={() => void requestPermission()} />
      </Box>
    );
  return (
    <View style={{ height: 300, borderRadius: 22, overflow: "hidden", backgroundColor: "#1C1C1E" }}>
      <CameraView
        style={{ flex: 1 }}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={({ data }) => onCode(data)}
      />
      <View pointerEvents="none" style={{ position: "absolute", top: 50, left: "50%", marginLeft: -100, width: 200, height: 200, borderWidth: 4, borderColor: "#fff", borderRadius: 20 }} />
    </View>
  );
}
export default function ScanDonor() {
  const client = useQueryClient();
  const [scanning, setScanning] = useState(false);
  const [typed, setTyped] = useState("");
  const [donorId, setDonorId] = useState<string | null>(null);
  const [badCode, setBadCode] = useState(false);
  const [type, setType] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [done, setDone] = useState<string>();
  const donor = useQuery({ queryKey: ["/donors/" + donorId + "/verification"], queryFn: () => send<DonorLookup>("get", `/donors/${donorId}/verification`), enabled: !!donorId });
  const accept = (raw: string) => {
    const id = parseDonorCode(raw);
    setBadCode(!id);
    if (!id) return;
    setScanning(false);
    setDone(undefined);
    setError(undefined);
    setType(null);
    setDonorId(id);
  };
  const confirmType = async () => {
    if (!donorId || !type) return;
    setBusy(true);
    setError(undefined);
    try {
      await send("patch", `/donors/${donorId}/verification`, { verifiedBloodType: type });
      await client.invalidateQueries();
      setDone(`Blood type ${displayType(type)} confirmed. This donor can now receive alerts.`);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  const d = donor.data;
  return (
    <Page>
      <H1>Scan donor card</H1>
      <Body muted>Scan the QR code on the donor’s LifeLink card to confirm their blood type.</Body>
      {scanning ? (
        <>
          <Scanner onCode={accept} />
          <BigButton title="Cancel" variant="ghost" size="medium" onPress={() => setScanning(false)} />
        </>
      ) : (
        <BigButton title={donorId ? "Scan another card" : "Scan a card"} icon="qr-code-outline" onPress={() => setScanning(true)} />
      )}
      {badCode ? <Notice text="That isn’t a LifeLink donor card. Try again, or type the donor ID below." tone="error" /> : null}
      {!donorId && !scanning && (
        <Box>
          <Text style={{ fontFamily: font.semibold, fontSize: 15, color: c.text }}>Camera not working? Type the full donor ID</Text>
          <TextInput
            accessibilityLabel="Donor ID"
            value={typed}
            onChangeText={setTyped}
            autoCapitalize="none"
            placeholder="24-character ID from the card"
            placeholderTextColor={c.muted}
            style={{ height: 54, borderWidth: 1, borderColor: "#DAD7D3", borderRadius: 14, paddingHorizontal: 14, fontFamily: font.regular, fontSize: 16, color: c.text }}
          />
          <BigButton title="Find donor" variant="secondary" size="medium" disabled={typed.trim().length < 24} onPress={() => accept(typed)} />
        </Box>
      )}
      {donorId && (donor.isPending ? (
        <Body muted>Looking up donor…</Body>
      ) : donor.error ? (
        <Notice text={errorText(donor.error)} tone="error" />
      ) : d ? (
        <Box highlight>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
            <View style={{ width: 60, height: 60, borderRadius: 16, backgroundColor: d.verifiedBloodType ? c.primary : "#F5F4F2", alignItems: "center", justifyContent: "center" }}>
              {d.verifiedBloodType ? (
                <Text style={{ fontFamily: font.bold, fontSize: 22, color: "#fff" }}>{displayType(d.verifiedBloodType)}</Text>
              ) : (
                <Ionicons name="help" size={28} color={c.muted} />
              )}
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ fontFamily: font.bold, fontSize: 19, color: c.text }}>{d.name}</Text>
              <Text style={{ fontFamily: font.regular, fontSize: 14, color: c.muted }}>{label(d.verificationStatus)}</Text>
            </View>
          </View>
          {done ? (
            <Notice text={done} tone="success" />
          ) : (
            <>
              <H3>{d.verifiedBloodType ? "Re-confirm blood type" : "Confirm blood type after testing"}</H3>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {bloodTypes.map((t) => (
                  <View key={t} style={{ width: "23%", flexGrow: 1 }}>
                    <Choice label={displayType(t)} selected={type === t} onPress={() => setType(t)} height={52} />
                  </View>
                ))}
              </View>
              <BigButton title={type ? `Confirm ${displayType(type)}` : "Choose the tested blood type"} variant="success" size="medium" disabled={!type} loading={busy} onPress={() => void confirmType()} />
              <Body muted size={13}>This records the donor’s blood group in LifeLink. It is not a medical fitness check.</Body>
            </>
          )}
          {error ? <Notice text={error} tone="error" /> : null}
        </Box>
      ) : null)}
    </Page>
  );
}
