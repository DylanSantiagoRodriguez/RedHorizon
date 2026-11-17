#!/usr/bin/env python3
"""Reproducible baseline. Rates queried from AWS Pricing API on 2026-11-16."""
import json
from decimal import Decimal as D
hours=D('730')
rates={'t3.micro':D('.0104'),'t3.small':D('.0208'),'m7i-flex.large':D('.09576')}
def monthly(instances, disk_gib, ips):
    compute=sum(rates[t]*n*hours for t,n in instances.items())
    return {'compute':compute,'gp3':D(str(disk_gib))*D('.08'),'ipv4':D(str(ips))*hours*D('.005')}
new=monthly({'t3.micro':2,'t3.small':2},80,4)
primary=monthly({'m7i-flex.large':1},28,1) # active 20 GiB plus retained original 8 GiB
others=monthly({'m7i-flex.large':1,'t3.micro':1},16,2)
total=sum(new.values())+sum(primary.values())
result={'basis':'730 hours/month; USD before credits, tax, transfer, snapshots and optional services','newFour':new,'existingPrimary':primary,'excludedOtherTwo':others,'newMonthly':sum(new.values()),'clusterFiveMonthly':total,'accountSevenMonthly':total+sum(others.values()),'creditObservedUSD':D('74.06'),'creditDaysAtAccountBaseline':D('74.06')/((total+sum(others.values()))/hours)/24,'labFourNew8HoursComputeAndIPv4':(2*rates['t3.micro']+2*rates['t3.small']+4*D('.005'))*8,'labFourStoppedDiskMonthly':D('6.4')}
print(json.dumps(result,default=lambda d:round(float(d),4),indent=2))
