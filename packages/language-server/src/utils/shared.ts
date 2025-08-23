import type { CodeInformation } from '@volar/language-core';

export const allCodeFeatures: CodeInformation = {
    verification: true,
    completion: true,
    semantic: true,
    navigation: true,
    structure: false,
    format: true,
};

export interface Mapping {
    generated: number;
    source: number;
    length: number;
    features?: CodeInformation
}
