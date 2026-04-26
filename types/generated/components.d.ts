import type { Schema, Struct } from '@strapi/strapi';

export interface AthleteStat extends Struct.ComponentSchema {
  collectionName: 'components_athlete_stats';
  info: {
    description: 'Single statistic: label and value strings.';
    displayName: 'Athlete stat';
  };
  attributes: {
    label: Schema.Attribute.String;
    value: Schema.Attribute.String;
  };
}

declare module '@strapi/strapi' {
  export module Public {
    export interface ComponentSchemas {
      'athlete.stat': AthleteStat;
    }
  }
}
