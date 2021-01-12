# Bitcoin SV Token Contract Project
## Prerequisites
1. Make sure you have the [sCrypt Visual Studio Extension](https://marketplace.visualstudio.com/items?itemName=bsv-scrypt.sCrypt) installed.

2. nodejs version >= 14.15.1.

## Guide

This Project is modified from [sCrypt Project Boilerplate](https://github.com/sCrypt-Inc/boilerplate). You can visit it to learn more details about sCrypt.

## Quickstart
```
npm install
npm test
```

## Directory layout
For each contract `x`, a source file is at `contracts/x.scrypt`, a test file is at `tests/js/x.scrypttest.js`, and a deployment file is at `deployments/x.js`.
<pre>
.
├── contracts                    # sCrypt contract files
│   ├── rabinUtil.scrypt         # rabin algorithm utility function and constants
│   ├── tokenBtp.scrypt          # token contract implementation
│   ├── tokenGenesis.scrypt      # token genesis contract, used to generate token contract
│   ├── tokenProto.scrypt        # token protocol utility function and constants
│   ├── tokenSell.scrypt         # a contract used to sell token with a fixed bsv price
│   ├── txUtil.scrypt            # raw transaction utility function and constants
│   └── util.scrypt              # utility functions and constants
├── deployments                  # examples to deploy contract and call its function on testnet
    ├── fixture
        └── autoGen              # contract description json files
    └── protoheader.js           # oraclesv proto header
    └── tokenBtp.js              # deploy tokenBtp contract to testnet
    └── tokenProto.js            # token protocol utility and constants
    └── tokenUtil.js             # utility function help to deploy token contract
├── rabin                        # rabin algorithm js lib 
├── tests                        # contract test files
    ├── js                       # Javascript unit tests
    └── ts                       # Typescript unit tests
</pre>

## How to run tests locally

You can get details from [sCrypt boilerplate README](https://github.com/sCrypt-Inc/boilerplate/blob/master/README.md).

### Run using sCrypt Extension
Run unit tests file within the editor/explorer context menu "Run sCrypt Test".

**Note:** The test files must be suffixed by `.scrypttest.js` or `.scrypttest.ts`, otherwise the "Run sCrypt Test" option would not appear in the menu.

### Run from console
Tests could also be run from the console by executing `npm test`, just like regular Javascript/TypeScript tests.

## How to deploy contracts

Deploy a contract and call its function by issuing 
```bash
node deployments/tokenBtp.js
```
