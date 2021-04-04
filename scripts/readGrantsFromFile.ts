import hardhat, { network } from "hardhat";
import fs from "fs";

export default function main() {
    const file = fs.readFileSync(`./grants/${network.name}.json`, 'utf-8')
    return JSON.parse(file)
}
