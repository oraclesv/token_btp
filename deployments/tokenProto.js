const proto = require('./protoheader')

const token = module.exports

// token specific
//<type specific data> = <token_name (10 bytes)> <is_genesis(1 byte)> <public key hash(20 bytes)> + <token value(8 bytes)> + <genesis script code hash as tokenid(20 bytes)> + <proto header>
const TOKEN_ID_LEN = 20
const TOKEN_VALUE_LEN = 8
const TOKEN_ADDRESS_LEN = 20
const GENESIS_FLAG_LEN = 1
const TOKEN_NAME_LEN = 10
const TOKEN_ID_OFFSET = TOKEN_ID_LEN + proto.getHeaderLen()
const TOKEN_VALUE_OFFSET = TOKEN_ID_OFFSET + TOKEN_VALUE_LEN
const TOKEN_ADDRESS_OFFSET = TOKEN_VALUE_OFFSET + TOKEN_ADDRESS_LEN
const GENESIS_FLAG_OFFSET = TOKEN_ADDRESS_OFFSET + GENESIS_FLAG_LEN
const TOKEN_NAME_OFFSET = GENESIS_FLAG_OFFSET + TOKEN_NAME_LEN 
const TOKEN_HEADER_LEN = TOKEN_NAME_OFFSET

token.TYPE = 1

token.getHeaderLen = function() {
  return TOKEN_HEADER_LEN
}

token.getTokenValue = function(script) {
  return script.readBigUInt64LE(script.length - TOKEN_VALUE_OFFSET)
}

token.getTokenID = function(script) {
  return script.subarray(script.length - TOKEN_ID_OFFSET, script.length - TOKEN_ID_OFFSET + TOKEN_ID_LEN);
}

token.getTokenAddress = function(script) {
  return script.subarray(script.length - TOKEN_ADDRESS_OFFSET, script.length - TOKEN_ADDRESS_OFFSET + TOKEN_ADDRESS_LEN);
}

token.getGenesisFlag = function(script) {
    return script.readUIntLE(script.length - GENESIS_FLAG_OFFSET, GENESIS_FLAG_LEN)
}

token.getTokenName = function(script) {
  return script.subarray(script.length - TOKEN_NAME_OFFSET, script.length - TOKEN_NAME_OFFSET + TOKEN_NAME_LEN).toString()
}
