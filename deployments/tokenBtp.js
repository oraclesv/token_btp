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
} = require('../privateKey');
const TokenUtil = require('./tokenUtil')
const utxo1 =  '8f6927c3f0841bdc97e08c604061793c5bed2ad1403f7ffc99c325c0adde9f32'
const outIndex1 = 1
const bsvBalance1 = 720000
const utxo2 = 'e765e837eb636bf1a83436204db9116fdc59c2ef3e56f1afdbe3172b518974b8'
const outIndex2 = 1
const bsvBalance2 = 630000
const utxo3 = 'ea661cb16881896d89719104630be7962258d6a8a22118f5590c45412941b09f'
const outIndex3 = 1
const bsvBalance3 = 1000000

const dustLimit = 546

const tokenName = Buffer.alloc(10, 0)
tokenName.write('tcc')

const tokenValue = 1000000
const decimalNum = 8

const address1 = privateKey.toAddress()
const address2 = privateKey2.toAddress()


async function createNewToken() {
  let outAmount1 = dustLimit + 10000
  let fee = 5000
  const contractHash = TokenUtil.getTokenContractHash()
  let genesisTx = TokenUtil.createGenesis(utxo1, outIndex1, bsv.Script.buildPublicKeyHashOut(address1), bsvBalance1, privateKey, fee, privateKey.publicKey, tokenName, contractHash, outAmount1, address1, decimalNum)

  //console.log('createGenesisTx:', genesisTx.id, genesisTx.serialize())
  //let txid = await sendTx(genesisTx)
  console.log('genesisTx id:', genesisTx.id)

  let genesisScript = genesisTx.outputs[0].script
  let inputAmount = genesisTx.outputs[0].satoshis

  const tokenTx = TokenUtil.createToken(genesisScript, tokenValue, address1, inputAmount, genesisTx.id, 0, dustLimit, privateKey, decimalNum)

  //console.log('createTokenTx:', tokenTx.id, tokenTx.serialize())
  return tokenTx
}

function createTokenTransferTx(tokenTx) {
  const tokenAmount1 = 1000
  const tokenAmount2 = tokenValue - tokenAmount1
  const inputAmount = tokenTx.outputs[0].satoshis
  const fee = 4000
  const outAmount1 = dustLimit
  const outAmount2 = dustLimit

  const tx = TokenUtil.createTokenTransfer(
    tokenTx.id,
    0,
    tokenTx.outputs[0].script,
    tokenTx.outputs[0].satoshis,
    privateKey,
    utxo2,
    outIndex2,
    bsv.Script.buildPublicKeyHashOut(address1),
    bsvBalance2,
    privateKey,
    fee,
    address1,
    tokenAmount1,
    outAmount1,
    address2,
    tokenAmount2,
    outAmount2,
    address1,
  )

  //console.log('createTokenTransferTx', tx.id, tx.serialize())
  return tx
}

(async() => {
  try {
    let tokenTx = await createNewToken()

    //let txid = await sendTx(tokenTx)
    console.log('tokenTx id:', tokenTx.id)

    let transferTx = createTokenTransferTx(tokenTx)
    //txid = await sendTx(transferTx)
    console.log('transferTx id:', transferTx.id)

  } catch (error) {
    console.log('Failed on testnet')
    showError(error)
  }
})()