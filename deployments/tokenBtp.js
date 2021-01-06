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
const utxo1 =  '0c247c076fae77377af29388195645a1aeaf71389da5aa906413cb08887c59e0'
const outIndex1 = 1
const bsvBalance1 = 1225056
const utxo2 = '7080be33ac72db16c77e6a2121f889304ee819a449b4523908c673fc784af4a8'
const outIndex2 = 1
const bsvBalance2 = 1209510
const utxo3 = '3b57a269322982c450111a8e052d73a5eea3db82d505c288c239a6b072d9d39f'
const outIndex3 = 1
const bsvBalance3 = 594000

const dustLimit = 546

const tokenName = Buffer.alloc(10, 0)
tokenName.write('tcc')

const tokenValue = 1000000
const decimalNum = 8

const address1 = privateKey.toAddress()
const address2 = privateKey2.toAddress()
const address3 = privateKey3.toAddress()


async function createNewToken() {
  let outAmount1 = dustLimit + 10000
  let fee = 5000
  const contractHash = TokenUtil.getTokenContractHash()
  let genesisTx = TokenUtil.createGenesis(utxo1, outIndex1, bsv.Script.buildPublicKeyHashOut(address1), bsvBalance1, privateKey, fee, privateKey.publicKey, tokenName, contractHash, outAmount1, address1, decimalNum)

  //console.log('createGenesisTx:', genesisTx.id, genesisTx.serialize())
  //let txid = await sendTx(genesisTx)
  console.log('genesisTx id:', genesisTx.id, genesisTx.serialize().length)

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
  const fee = 10000

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
    //TODO: add rabin msg
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
  const fee = 10000

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
    const tokenValue = TokenProto.getTokenValue(scriptBuf)
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
      tokenID,
      txidBuf,
      indexBuf,
      bufValue,
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

    //let txid = await sendTx(tokenTx)
    console.log('tokenTx id:', tokenTx.id, tokenTx.serialize().length)

    // 1 input token with 3 output token
    let transferTx = createTokenTransferTx(tokenTx)
    //txid = await sendTx(transferTx)
    console.log('transferTx id:', transferTx.id, transferTx.serialize().length)

    // 3 input token with 1 output token
    let transferTx2 = createTokenTransferTx2(transferTx)
    //txid = await sendTx(transferTx2)
    console.log('transferTx2 id:', transferTx2.id, transferTx2.serialize().length)
  } catch (error) {
    console.log('Failed on testnet')
    showError(error)
  }
})()