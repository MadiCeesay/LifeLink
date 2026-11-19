import React from "react";
import { Text, View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { useAuth } from "../../providers/AuthProvider";
import { useResource } from "../../hooks/api";
import type { Verification } from "../../types/api";
import { Body, Page, TopBar, displayType, font } from "../../components/kit";
import { colors as c } from "../../theme";
import { qrValue } from "../../utils/qr";
export default function DonorCard() {
  const { user } = useAuth();
  const ver = useResource<Verification>("/donors/me/verification");
  const verified = ver.data?.verificationStatus === "VERIFIED";
  const shortId = user?.id.slice(-6).toUpperCase();
  return (
    <Page>
      <TopBar title="My donor card" />
      <View style={{ backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 24, overflow: "hidden" }}>
        <View style={{ backgroundColor: c.primary, padding: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={{ gap: 4, flex: 1 }}>
            <Text style={{ fontFamily: font.bold, fontSize: 22, color: "#fff" }}>{user?.name}</Text>
            <Text style={{ fontFamily: font.regular, fontSize: 14, color: "#fff" }}>Donor ID · LL-{shortId}</Text>
          </View>
          <View style={{ width: 72, height: 72, borderRadius: 18, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontFamily: font.bold, fontSize: verified ? 28 : 22, color: c.primary }}>{verified ? displayType(ver.data?.verifiedBloodType) : "?"}</Text>
          </View>
        </View>
        <View style={{ padding: 24, alignItems: "center", gap: 16 }}>
          <View accessible accessibilityLabel="Donor QR code" style={{ padding: 14, borderRadius: 16, borderWidth: 1, borderColor: c.border, backgroundColor: "#fff" }}>
            {user && <QRCode value={qrValue(user.id)} size={210} />}
          </View>
          <Body center muted>
            {verified ? "Show this at the hospital to check in." : "Show this at a partner hospital so staff can confirm your blood type."}
          </Body>
        </View>
        <View style={{ borderTopWidth: 1, borderTopColor: "#F0EEEB", padding: 16, flexDirection: "row", gap: 12 }}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={{ fontFamily: font.regular, fontSize: 13, color: c.muted }}>Verified by</Text>
            <Text style={{ fontFamily: font.bold, fontSize: 15, color: c.text }}>{ver.data?.verifiedByFacility?.name ?? "Not yet"}</Text>
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={{ fontFamily: font.regular, fontSize: 13, color: c.muted }}>Full ID (if scanning fails)</Text>
            <Text selectable style={{ fontFamily: font.semibold, fontSize: 12, color: c.text }}>{user?.id}</Text>
          </View>
        </View>
      </View>
      <Body center muted size={14}>Keep your screen bright when it’s scanned.</Body>
    </Page>
  );
}
