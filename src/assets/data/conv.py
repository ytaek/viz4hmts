import os, sys

print("symbol,date,price")
for line in open(sys.argv[1], "r"):
    items = line.strip().split(",")
    prices = items[1:]
    
    for i, price in enumerate(prices):
        print(",".join([items[0], str(i), str(price)]))

    
    

