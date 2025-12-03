declare module 'turndown' {
  export interface TurndownOptions {
    headingStyle?: 'setext' | 'atx';
    hr?: string;
    bulletListMarker?: string;
    codeBlockStyle?: 'indented' | 'fenced';
    fence?: string;
    emDelimiter?: string;
    strongDelimiter?: string;
    linkStyle?: 'inlined' | 'referenced';
    linkReferenceStyle?: 'full' | 'collapsed' | 'shortcut';
  }

  export default class TurndownService {
    constructor(options?: TurndownOptions);
    turndown(html: string): string;
    addRule(key: string, rule: any): this;
    use(plugin: (service: TurndownService) => void): this;
  }
}

