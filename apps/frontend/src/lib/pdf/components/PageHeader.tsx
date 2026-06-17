import React from 'react';
import { View, Text, Image } from '@react-pdf/renderer';
import { F, FS } from '../design/typography';
import { N } from '../design/colors';

interface Props {
  company: any;
  os: any;
  reportTitle: string;
  pc: string;
}

export function PageHeader({ company, os, reportTitle, pc }: Props) {
  const nom = company?.commercialName ?? company?.name ?? '';
  const details = [
    company?.nit   ? `NIT: ${company.nit}` : null,
    company?.city  ?? null,
    company?.phone ?? null,
  ].filter(Boolean).join('  ·  ');

  return (
    <View fixed style={{
      position: 'absolute', top: 0, left: 0, right: 0,
      height: 50, flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: 36, paddingTop: 8,
      backgroundColor: N.white,
      borderBottomWidth: 0.5, borderBottomColor: N.gray200,
    }}>
      {/* Logo */}
      <View style={{ width: 70, alignItems: 'flex-start' }}>
        {company?.logoData
          ? <Image src={company.logoData} style={{ height: 24, maxWidth: 68, objectFit: 'contain' }} />
          : <Text style={{ fontSize: FS.label + 0.5, fontFamily: F.bold, color: pc }}>{nom}</Text>
        }
      </View>
      {/* Centre: company info */}
      <View style={{ flex: 1, alignItems: 'center' }}>
        <Text style={{ fontSize: 7.5, fontFamily: F.bold, color: N.gray900 }}>{nom}</Text>
        {details ? <Text style={{ fontSize: FS.label, color: N.gray400, marginTop: 1 }}>{details}</Text> : null}
      </View>
      {/* Right: report type + OS */}
      <View style={{ width: 130, alignItems: 'flex-end' }}>
        <Text style={{ fontSize: 7.5, fontFamily: F.bold, color: pc }}>{reportTitle}</Text>
        <Text style={{ fontSize: FS.label, color: N.gray400, marginTop: 1 }}>OS: {os?.osNumber}</Text>
      </View>
    </View>
  );
}
