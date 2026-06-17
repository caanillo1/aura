import React from 'react';
import { View, Text, Image } from '@react-pdf/renderer';
import { F, FS } from '../design/typography';
import { N, alpha } from '../design/colors';

interface Signature {
  id: string;
  fullName?: string | null;
  jobTitle?: string | null;
  signatureData?: string | null;
  signedAt?: string | null;
}

interface Props {
  signatures: Signature[];
  pc: string;
}

const SIG_MAX_H = 55;  // max image height in pt (compact)
const SIG_MAX_W = 120;

const fmtDate = (s?: string | null) => {
  if (!s) return null;
  return new Date(s).toLocaleDateString('es-CO', {
    timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric',
  });
};

export function SignatureSection({ signatures, pc }: Props) {
  if (signatures.length === 0) return null;
  return (
    <View style={{ marginTop: 16 }}>
      <View style={{ height: 0.5, backgroundColor: N.gray200, marginBottom: 12 }} />
      <Text style={{ fontSize: FS.label, fontFamily: F.bold, textTransform: 'uppercase',
        letterSpacing: 0.8, color: N.gray400, marginBottom: 10 }}>
        FIRMAS Y APROBACIONES
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {signatures.map((sig) => {
          const signed = !!sig.signedAt;
          return (
            <View key={sig.id} wrap={false} style={{
              flex: 1, minWidth: 140, maxWidth: 200,
              padding: '10 12', borderRadius: 6,
              borderWidth: 0.5, borderColor: signed ? alpha('#065f46', 0.3) : N.gray200,
              backgroundColor: signed ? '#f0fdf4' : N.gray50,
            }}>
              {/* Signature image or blank line */}
              <View style={{ height: SIG_MAX_H, justifyContent: 'flex-end', marginBottom: 6,
                borderBottomWidth: 0.5, borderBottomColor: N.gray300 }}>
                {sig.signatureData ? (
                  <Image
                    src={sig.signatureData}
                    style={{ maxHeight: SIG_MAX_H - 8, maxWidth: SIG_MAX_W,
                      objectFit: 'contain', alignSelf: 'center' }}
                  />
                ) : null}
              </View>
              <Text style={{ fontSize: 7.5, fontFamily: F.bold, color: N.gray900, marginBottom: 1 }}>
                {sig.fullName ?? '—'}
              </Text>
              {sig.jobTitle && (
                <Text style={{ fontSize: FS.caption + 0.5, color: N.gray500, marginBottom: 3 }}>
                  {sig.jobTitle}
                </Text>
              )}
              {signed ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: '#059669' }} />
                  <Text style={{ fontSize: FS.caption, color: '#059669', fontFamily: F.bold }}>
                    Firmado {fmtDate(sig.signedAt)}
                  </Text>
                </View>
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: N.gray300 }} />
                  <Text style={{ fontSize: FS.caption, color: N.gray400 }}>Pendiente de firma</Text>
                </View>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}
