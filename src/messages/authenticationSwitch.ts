import { BinaryReader } from "../binary-reader";
import { AuthenticationOK } from "./AuthenticationOK";
import { AuthenticationSASL } from "./AuthenticationSASL";
import { ErrorResponse } from "./ErrorResponse";

/** Determines which authentication response packet was returned. */
export function authenticationSwitch(buffer: Uint8Array) {
  const reader = new BinaryReader(buffer);
  const code = reader.readByte();
  // console.assert(
  //   code === 0x52, // 'R'
  //   `Expected 'R', got ${String.fromCharCode(code)}`,
  // );

  const length = reader.readInt32();
  const tag = reader.readInt32();
  switch (tag) {
    case 0:
      return AuthenticationOK.parse(buffer);
    case 2:
      // TODO: AuthenticationKerberosV5
      return "AuthenticationKerberosV5";
    case 3:
      // TODO: AuthenticationCleartextPassword
      return "AuthenticationCleartextPassword";
    case 5:
      // TODO: AuthenticationMD5Password
      return "AuthenticationMD5Password";
    // case 0x05:
    //   // TODO: AuthenticationSCMCredential
    case 7:
      // TODO: AuthenticationGSS
      return "AuthenticationGSS";
    case 8:
      // TODO: AuthenticationGSSContinue
      return "AuthenticationGSSContinue";
    case 9:
      // TODO: AuthenticationSSPI
      return "AuthenticationSSPI";
    case 10:
      return AuthenticationSASL.parse(buffer);
    case 11:
      // TODO: AuthenticationSASLContinue
      return "AuthenticationSASLContinue";
    case 12:
      // TODO: AuthenticationSASLFinal
      return "AuthenticationSASLFinal";
    default:
      return ErrorResponse.parse(buffer);
  }
}
