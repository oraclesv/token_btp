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
const TokenUtil = require('./tokenUtil')
const utxo1 =  '213bc4eaa56eececf37c2ef31ebdd159c3f48cfd0297b02273ae06f4ce913f99'
const outIndex1 = 1
const bsvBalance1 = 49887
const utxo2 = 'ea661cb16881896d89719104630be7962258d6a8a22118f5590c45412941b09f'
const outIndex2 = 1
const bsvBalance2 = 1000000

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

function createTokenTransferTx(tokenTx) {
  const tokenAmount1 = 1000
  const tokenAmount2 = 2000
  const tokenAmount3 = tokenValue - tokenAmount1 - tokenAmount2
  const inputAmount = tokenTx.outputs[0].satoshis
  const fee = 4000

  const tokenInputArray = []
  const satoshiInputArray = []
  const rabinPubKey = 1
  const rabinMsgArray = Buffer.alloc(0)
  const rabinPaddingArray = Buffer.alloc(0)
  const rabinSigArray = Buffer.alloc(0)
  const senderPrivKeyArray = []
  const satoshiInputPrivKeyArray = []
  const tokenOutputArray = []
  const changeSatoshi = inputAmount - fee - dustLimit * 3
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

(async() => {
  try {
    /*const Token = buildContractClass(loadDesc('tokenBtp_desc.json'))
    token = new Token()
    const script = token.lockingScript
    console.log('script len: ', script.toBuffer().length)*/

    let tokenTx = await createNewToken()

    //let txid = await sendTx(tokenTx)
    console.log('tokenTx id:', tokenTx.id, tokenTx.serialize().length)

    let transferTx = createTokenTransferTx(tokenTx)
    //txid = await sendTx(transferTx)
    console.log('transferTx id:', transferTx.id, transferTx.serialize().length)

  } catch (error) {
    console.log('Failed on testnet')
    showError(error)
  }
})()