const {
    bsv,
    buildContractClass,
    getPreimage,
    toHex,
    num2bin,
    SigHashPreimage,
    signTx,
    PubKey,
    Sig,
    Bytes,
    Ripemd160,
} = require('scryptlib');
const {
    DataLen,
    loadDesc,
    sendTx,
    showError,
} = require('../helper');
const {
    privateKey,
    privateKey2,
    privateKey3,
} = require('../privateKey');
const TokenProto = require('./TokenProto');
const {toBufferLE} = require('bigint-buffer')

const Rabin = require('../rabin/rabin')

const rabinPrivateKey = {
  "p": 5757440790098238249206056886132360783939976756626308615141839695681752813612764520921497694519841722889028334119917789649651692480869415368298368200263n,
  "q": 650047001204168007801848889418948532353073326909497585177081016045346562912146630794965372241635285465610094863279373295872825824127728241709483771067n
}
const rabinPubKey = Rabin.privKeyToPubKey(rabinPrivateKey.p, rabinPrivateKey.q)

const TokenUtil = require('./tokenUtil')
const utxo1 =  'b9c503696c01bf68d3ab98d1801164e32a906139de875a83918df37488ff00af'
const outIndex1 = 1
const bsvBalance1 = 673362
const utxo2 = '17cf4fb80c9a40850578059b3e4675f66395f842f105b50fb8aec3435de7fa5d'
const outIndex2 = 1
const bsvBalance2 = 34341
const utxo3 = '7d2304932c5b4ba78410ede6bbd4a526caf231f643353fdfb30ae376c9b0a97f'
const outIndex3 = 1
const bsvBalance3 = 578454

const dustLimit = 546

const tokenName = Buffer.alloc(20, 0)
tokenName.write('test token name')
const tokenSymbol = Buffer.alloc(10, 0)
tokenSymbol.write('ttn')

const tokenValue = 1000000
const decimalNum = 8

const address1 = privateKey.toAddress()
const address2 = privateKey2.toAddress()
const address3 = privateKey3.toAddress()


async function createNewToken() {
  let outAmount1 = dustLimit + 10000
  let fee = 5000
  const contractHash = TokenUtil.getTokenContractHash()
  let genesisTx = TokenUtil.createGenesis(utxo1, outIndex1, bsv.Script.buildPublicKeyHashOut(address1), bsvBalance1, privateKey, fee, privateKey.publicKey, tokenName, tokenSymbol, contractHash, outAmount1, address1, decimalNum)

  //console.log('createGenesisTx:', genesisTx.id, genesisTx.serialize())
  //await sendTx(genesisTx)
  console.log('genesisTx id:', genesisTx.id, genesisTx.serialize().length / 2)

  let genesisScript = genesisTx.outputs[0].script
  let inputAmount = genesisTx.outputs[0].satoshis

  const tokenTx = TokenUtil.createToken(genesisScript, tokenValue, address1, inputAmount, genesisTx.id, 0, dustLimit, privateKey, decimalNum)

  //console.log('createTokenTx:', tokenTx.id, tokenTx.serialize())
  return tokenTx
}

// only one token input
function createTokenTransferTx(tokenTx) {
  const tokenAmount1 = 1000
  const tokenAmount2 = 2000
  const tokenAmount3 = tokenValue - tokenAmount1 - tokenAmount2
  const inputAmount = tokenTx.outputs[0].satoshis
  const fee = 15000

  const tokenInputArray = []
  const satoshiInputArray = []
  const rabinMsgArray = Buffer.alloc(0)
  const rabinPaddingArray = Buffer.alloc(0)
  const rabinSigArray = Buffer.alloc(0)
  const senderPrivKeyArray = []
  const satoshiInputPrivKeyArray = []
  const tokenOutputArray = []
  let changeSatoshi = inputAmount - fee - dustLimit * 3
  const changeAddress = address1

  const tokenInput = {
    lockingScript: tokenTx.outputs[0].script,
    satoshis: tokenTx.outputs[0].satoshis,
    txId: tokenTx.id,
    outputIndex: 0
  }
  tokenInputArray.push(tokenInput)

  // if only one token input, donot need rabin sign
  if (tokenInputArray.length > 1) {
  }

  const satoshiInput = {
    lockingScript: bsv.Script.buildPublicKeyHashOut(address1),
    satoshis: bsvBalance2,
    txId: utxo2,
    outputIndex: outIndex2,
  }
  satoshiInputArray.push(satoshiInput)
  changeSatoshi += bsvBalance2

  senderPrivKeyArray.push(privateKey)
  satoshiInputPrivKeyArray.push(privateKey)

  const tokenOutput = {
    address: address2,
    tokenAmount: tokenAmount1,
    satoshis: dustLimit
  }
  tokenOutputArray.push(tokenOutput)

  const tokenOutput2 = {
    address: address2,
    tokenAmount: tokenAmount2,
    satoshis: dustLimit
  }
  tokenOutputArray.push(tokenOutput2)

  const tokenOutput3 = {
    address: address2,
    tokenAmount: tokenAmount3,
    satoshis: dustLimit
  }
  tokenOutputArray.push(tokenOutput3)

  const tx = TokenUtil.createTokenTransfer(
    tokenInputArray,
    satoshiInputArray,
    rabinPubKey,
    rabinMsgArray,
    rabinPaddingArray,
    rabinSigArray,
    senderPrivKeyArray,
    satoshiInputPrivKeyArray,
    tokenOutputArray,
    changeSatoshi,
    changeAddress
  )

  //console.log('createTokenTransferTx', tx.id, tx.serialize())
  return tx
}

// multi token input
function createTokenTransferTx2(tokenTx) {
  const inputAmount = tokenTx.outputs[0].satoshis
  const fee = 15000

  const tokenInputArray = []
  const satoshiInputArray = []
  let rabinMsgArray = Buffer.alloc(0)
  let rabinPaddingArray = Buffer.alloc(0)
  let rabinSigArray = Buffer.alloc(0)
  const senderPrivKeyArray = []
  const satoshiInputPrivKeyArray = []
  const tokenOutputArray = []
  let changeSatoshi = inputAmount - fee - dustLimit
  const changeAddress = address1
  const nTokenInput = 3

  let allTokenInput = BigInt(0)
  for (let i = 0; i < nTokenInput; i++) {
    const lockingScript = tokenTx.outputs[i].script
    const scriptBuf = lockingScript.toBuffer()
    const scriptHashBuf = bsv.crypto.Hash.sha256ripemd160(scriptBuf)
    const satoshisBuf = Buffer.alloc(8, 0)
    satoshisBuf.writeBigUInt64LE(BigInt(tokenTx.outputs[i].satoshis))
    const tokenValue = TokenProto.getTokenAmount(scriptBuf)
    const tokenID = TokenProto.getTokenID(scriptBuf)
    const tokenInput = {
      lockingScript: lockingScript,
      satoshis: tokenTx.outputs[i].satoshis,
      txId: tokenTx.id,
      outputIndex: i
    }
    tokenInputArray.push(tokenInput)
    senderPrivKeyArray.push(privateKey2)
    allTokenInput += tokenValue

    const indexBuf = Buffer.alloc(4, 0)
    indexBuf.writeUInt32LE(i)
    const txidBuf = Buffer.from([...Buffer.from(tokenTx.id, 'hex')].reverse())

    const bufValue = Buffer.alloc(8, 0)
    bufValue.writeBigUInt64LE(BigInt(tokenValue))
    const msg = Buffer.concat([
      txidBuf,
      indexBuf,
      scriptHashBuf,
      satoshisBuf,
      bufValue,
      tokenID,
    ])
    rabinMsgArray = Buffer.concat([rabinMsgArray, msg])
    const rabinSignResult = Rabin.sign(msg.toString('hex'), rabinPrivateKey.p, rabinPrivateKey.q, rabinPubKey)
    //console.log('rabinsignature:', msg.toString('hex'), rabinSignResult.paddingByteCount, rabinSignResult.signature)
    const sigBuf = toBufferLE(rabinSignResult.signature, 128)
    rabinSigArray = Buffer.concat([rabinSigArray, sigBuf])
    const paddingCountBuf = Buffer.alloc(2, 0)
    paddingCountBuf.writeUInt16LE(rabinSignResult.paddingByteCount)
    const padding = Buffer.alloc(rabinSignResult.paddingByteCount, 0)
    rabinPaddingArray = Buffer.concat([
      rabinPaddingArray,
      paddingCountBuf,
      padding
    ])
  }

  const satoshiInput = {
    lockingScript: bsv.Script.buildPublicKeyHashOut(address1),
    satoshis: bsvBalance3,
    txId: utxo3,
    outputIndex: outIndex3,
  }
  satoshiInputArray.push(satoshiInput)
  changeSatoshi += bsvBalance3

  satoshiInputPrivKeyArray.push(privateKey)

  const tokenOutput = {
    address: address1,
    tokenAmount: allTokenInput,
    satoshis: dustLimit
  }
  tokenOutputArray.push(tokenOutput)

  const tx = TokenUtil.createTokenTransfer(
    tokenInputArray,
    satoshiInputArray,
    rabinPubKey,
    rabinMsgArray,
    rabinPaddingArray,
    rabinSigArray,
    senderPrivKeyArray,
    satoshiInputPrivKeyArray,
    tokenOutputArray,
    changeSatoshi,
    changeAddress
  )

  //console.log('createTokenTransferTx', tx.id, tx.serialize())
  return tx
}

(async() => {
  try {
    /*const Token = buildContractClass(loadDesc('tokenBtp_desc.json'))
    token = new Token()
    const script = token.lockingScript
    console.log('script len: ', script.toBuffer().length)*/

    let tokenTx = await createNewToken()

    //await sendTx(tokenTx)
    console.log('tokenTx id:', tokenTx.id, tokenTx.serialize().length / 2)

    // 1 input token with 3 output token
    let transferTx = createTokenTransferTx(tokenTx)
    //await sendTx(transferTx)
    console.log('transferTx id:', transferTx.id, transferTx.serialize().length / 2)

    // 3 input token with 1 output token
    let transferTx2 = createTokenTransferTx2(transferTx)
    //await sendTx(transferTx2)
    console.log('transferTx2 id:', transferTx2.id, transferTx2.serialize().length / 2)
  } catch (error) {
    console.log('Failed on testnet')
    showError(error)
  }
})()