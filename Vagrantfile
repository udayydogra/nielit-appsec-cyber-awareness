# NIELIT AppSec + Cyber-Awareness Platform — one-command VM, works out of the box.
#
#   vagrant up --provider=libvirt      # Linux/KVM host (Debian, Fedora, …)  ← needs vagrant-libvirt
#   vagrant up --provider=virtualbox   # VirtualBox host (Windows/Mac/Linux)
#   → Web  http://localhost:8080   ·   API  http://localhost:4000/health
#
# The `generic/*` box supports BOTH providers, so pick whichever you have.
#   libvirt one-time setup:  vagrant plugin install vagrant-libvirt
#   (and on the host:  sudo apt install -y qemu-kvm libvirt-daemon-system rsync
#                      sudo usermod -aG libvirt,kvm $USER   # then log out/in
#                      sudo systemctl enable --now libvirtd)
Vagrant.configure("2") do |config|
  config.vm.box = "generic/debian12"       # multi-provider (libvirt, virtualbox, hyperv, …)
  config.vm.hostname = "nielit-platform"

  # Forward the app ports host → guest so you browse from your own machine.
  config.vm.network "forwarded_port", guest: 8080, host: 8080, id: "web"
  config.vm.network "forwarded_port", guest: 4000, host: 4000, id: "api"

  # rsync works on EVERY provider with no host NFS/9p setup. The provision script
  # then copies /vagrant → /opt/nielit (a native dir) before building.
  config.vm.synced_folder ".", "/vagrant", type: "rsync",
    rsync__exclude: [".git/", "node_modules/", "dist/", ".env"]

  # libvirt / KVM (native + fast on a Linux host)
  config.vm.provider "libvirt" do |lv|
    lv.memory = 6144   # stack targets ~5 GB; headroom for lab containers
    lv.cpus   = 2
  end

  # VirtualBox
  config.vm.provider "virtualbox" do |vb|
    vb.name   = "nielit-appsec-cyber-awareness"
    vb.memory = 6144
    vb.cpus   = 2
  end

  # One-shot provisioning: installs Docker + Compose (Debian/Ubuntu aware),
  # generates secrets, builds Tier-3 lab images, `docker compose up -d`.
  config.vm.provision "shell", path: "scripts/provision-vm.sh"
end
