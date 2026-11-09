// Lab catalogue. To add a lab: create a LabDef file in this folder and list it here.
import type { LabDef } from '../sim/types'
import vlanBasics from './vlan-basics'
import troubleshoot from './trunk-troubleshoot'
import hardening from './trunk-hardening'
import campus from './campus-l2-l3'
import stpLb from './stp-load-balancing'
import ecTrouble from './etherchannel-troubleshoot'
import l3Static from './l3-static-routing'
import mgmt from './mgmt-vlan'
import ospfSingle from './ospf-single-area'
import routedAccess from './routed-access'
import bpduGuard from './bpdu-guard'
import ospfTrouble from './ospf-troubleshoot'
import ospfMulti from './ospf-multiarea'

export const LABS: LabDef[] = [vlanBasics, troubleshoot, hardening, campus, stpLb, ecTrouble, l3Static, mgmt, ospfSingle, routedAccess, bpduGuard, ospfTrouble, ospfMulti]

export function findLab(id: string): LabDef | undefined {
  return LABS.find((l) => l.id === id)
}
