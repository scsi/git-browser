#! /bin/sh

mkdir test.git
export GIT_DIR=test.git
git-init-db

echo "Hello World" >hello
echo "Silly example" >example
mkdir dir
echo "file in a dir" > dir/file

git-update-index --add hello example dir/file
echo "It's a new day for git" >>hello
git commit -m "initital commit"

git-update-index hello
git commit -m "bring hello up to date"
git tag my-first-tag

git checkout -b mybranch
echo "Work, work, work" >>hello
git commit -m 'Some work.' hello


git checkout master
echo "Play, play, play" >>hello
echo "Lots of fun" >>example
git commit -m 'Some fun.' hello example


git resolve HEAD mybranch "Merge work in mybranch"
echo "Hello World" > hello
echo "It's a new day for git" >>hello
echo "Play, play, play" >> hello
echo "Work, work, work" >> hello
git commit -m "mybranch merged" hello

rm hello
rm example
rm dir/file
rmdir dir
