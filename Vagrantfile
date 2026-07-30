# NIELIT AppSec + Cyber-Awareness Platform — VirtualBox VM, works out of the box.
#
#   vagrant up          # boots Ubuntu, installs Docker, brings the whole stack up
#   → Web  http://localhost:8080   ·   API  http://localhost:4000/health
#   vagrant halt        # stop     ·   vagrant destroy   # remove
#
# Requires: VirtualBox + Vagrant on the host. No other setup.
Vagrant.configure("2") do |config|
  config.vm.box = "ubuntu/jammy64"          # Ubuntu 22.04 LTS
  config.vm.hostname = "nielit-platform"

  # Forward the app ports host → guest so you browse from your own machine.
  config.vm.network "forwarded_port", guest: 8080, host: 8080, id: "web"   # frontend
  config.vm.network "forwarded_port", guest: 4000, host: 4000, id: "api"   # backend

  # The repo is auto-synced to /vagrant; the provision script copies it to
  # /opt/nielit (a native dir) before building so Docker isn't fighting the
  # VirtualBox shared folder.
  config.vm.synced_folder ".", "/vagrant"

  config.vm.provider "virtualbox" do |vb|
    vb.name   = "nielit-appsec-cyber-awareness"
    vb.memory = 6144    # the stack is sized for ~5 GB; 6 GB leaves headroom for lab containers
    vb.cpus   = 2
  end

  # Grow the disk if the vagrant-disksize plugin is installed (Docker images need room).
  #   vagrant plugin install vagrant-disksize
  if Vagrant.has_plugin?("vagrant-disksize")
    config.disksize.size = "30GB"
  end

  # One-shot provisioning: installs Docker + Compose, generates secrets, `up -d --build`.
  config.vm.provision "shell", path: "scripts/provision-vm.sh"
end
