import { ProtocolWithReturn } from 'webext-bridge'

declare module 'webext-bridge' {
  export interface ProtocolMap {
    test: ProtocolWithReturn<{ a: string, b: number }, { result: boolean }>
  }
}