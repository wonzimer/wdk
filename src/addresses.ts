import rinkebyAddresses from '@wonzimer-nft/core/dist/addresses/4.json'
import mainnetAddresses from '@wonzimer-nft/core/dist/addresses/1.json'

interface AddressBook {
  [key: string]: {
    [key: string]: string
  }
}

/**
 * Mapping from Network to Officially Deployed Instances of the Wonzimer Media Protocol
 */
export const addresses: AddressBook = {
  rinkeby: rinkebyAddresses,
  mainnet: mainnetAddresses,
}
