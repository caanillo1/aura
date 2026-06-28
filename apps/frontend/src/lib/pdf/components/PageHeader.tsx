import React from 'react';
import { View, Text, Image } from '@react-pdf/renderer';
import { F, FS } from '../design/typography';
import { N, alpha } from '../design/colors';

interface Props {
  company: any;
  os: any;
  reportTitle: string;
  pc: string;
}

export function PageHeader({ company, os, reportTitle, pc }: Props) {
  const nom = company?.commercialName ?? company?.name ?? '';

  return (
    <View fixed style={{ position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'column' }}>
      {/* Top accent line — brand color */}
      <View style={{ height: 3, backgroundColor: pc }} />

      {/* Header row */}
      <View style={{
        height: 44, flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 36, paddingTop: 6,
        backgroundColor: N.white,
      }}>
        {/* Left: logo */}
        <View style={{ width: 90, alignItems: 'flex-start' }}>
          {company?.logoData
            ? <Image src={company.logoData} style={{ height: 20, maxWidth: 86, objectFit: 'contain' }} />
            : <Text style={{ fontSize: 8, fontFamily: F.bold, color: pc }}>{nom}</Text>
          }
        </View>

        {/* Center: company */}
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={{ fontSize: 7, color: N.gray400 }}>{nom}</Text>
        </View>

        {/* Right: report label + OS */}
        <View style={{ width: 140, alignItems: 'flex-end', gap: 2 }}>
          <Text style={{ fontSize: 7.5, fontFamily: F.bold, color: pc }}>{reportTitle}</Text>
          <Text style={{ fontSize: 6.5, color: N.gray400 }}>OS: {os?.osNumber}</Text>
        </View>
      </View>

      {/* Bottom hairline */}
      <View style={{ height: 0.5, backgroundColor: N.gray100, marginHorizontal: 36 }} />
    </View>
  );
}
