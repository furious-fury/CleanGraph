// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import { IERC20Errors } from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";
import { TRWA } from "../contracts/TRWA.sol";

interface Vm {
    function expectRevert(bytes4 selector) external;
    function expectRevert(bytes calldata revertData) external;
    function prank(address sender) external;
}

contract TRWATest {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    address private constant TREASURY = address(0xA11CE);
    address private constant RECIPIENT = address(0xB0B);

    TRWA private token;

    function setUp() public {
        token = new TRWA(TREASURY);
    }

    function testMetadataAndSupply() public view {
        require(keccak256(bytes(token.name())) == keccak256(bytes("Tokenized Real-World Asset")));
        require(keccak256(bytes(token.symbol())) == keccak256(bytes("TRWA")));
        require(token.decimals() == 18);
        require(token.FIXED_SUPPLY() == 1_000_000 ether);
        require(token.totalSupply() == 1_000_000 ether);
        require(token.balanceOf(TREASURY) == 1_000_000 ether);
    }

    function testRejectsZeroTreasury() public {
        vm.expectRevert(TRWA.ZeroTreasury.selector);
        new TRWA(address(0));
    }

    function testTransfers() public {
        vm.prank(TREASURY);
        require(token.transfer(RECIPIENT, 125 ether));
        require(token.balanceOf(TREASURY) == 999_875 ether);
        require(token.balanceOf(RECIPIENT) == 125 ether);
        require(token.totalSupply() == 1_000_000 ether);
    }

    function testFuzzTransfer(uint128 rawAmount) public {
        uint256 amount = uint256(rawAmount) % (token.totalSupply() + 1);
        vm.prank(TREASURY);
        require(token.transfer(RECIPIENT, amount));
        require(token.balanceOf(RECIPIENT) == amount);
        require(token.balanceOf(TREASURY) == token.totalSupply() - amount);
    }

    function testRejectsInsufficientBalance() public {
        vm.prank(RECIPIENT);
        vm.expectRevert(
            abi.encodeWithSelector(IERC20Errors.ERC20InsufficientBalance.selector, RECIPIENT, 0, 1)
        );
        // forge-lint: disable-next-line(erc20-unchecked-transfer)
        token.transfer(TREASURY, 1);
    }

    function testRejectsZeroAddressTransfer() public {
        vm.prank(TREASURY);
        vm.expectRevert(
            abi.encodeWithSelector(IERC20Errors.ERC20InvalidReceiver.selector, address(0))
        );
        // forge-lint: disable-next-line(erc20-unchecked-transfer)
        token.transfer(address(0), 1);
    }

    function testHasNoCallableMintPath() public {
        (bool succeeded,) =
            address(token).call(abi.encodeWithSignature("mint(address,uint256)", TREASURY, 1));
        require(!succeeded);
        require(token.totalSupply() == 1_000_000 ether);
    }
}
